import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { agency, teamMember, emailVerification } from "../db/schema";
import { publicProcedure, router } from "../trpc";
import { sendEmailVerification, sendPasswordResetEmail } from "../services/email.service";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";

export const authRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        agencyName: z.string().min(2),
        country: z.string().optional(),
        currency: z.string().default("USD"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      console.log(`[SIGNUP] Input: email="${email}", name="${input.name}", agencyName="${input.agencyName}"`);

      const existing = await ctx.db.query.teamMember.findFirst({
        where: (m, { eq }) => eq(m.email, email),
      });

      if (existing) {
        console.log(`[SIGNUP] Conflict: email="${email}" already registered.`);
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already registered. Log in instead.",
        });
      }

      const agencyId = randomUUID();
      console.log(`[SIGNUP] Creating agency: id="${agencyId}", name="${input.agencyName}"`);
      await ctx.db.insert(agency).values({
        id: agencyId,
        name: input.agencyName,
        country: input.country,
        currency: input.currency,
      });

      const passwordHash = await bcrypt.hash(input.password, 10);
      const memberId = randomUUID();
      console.log(`[SIGNUP] Creating teamMember: id="${memberId}", email="${email}"`);

      await ctx.db.insert(teamMember).values({
        id: memberId,
        name: input.name,
        email: email,
        passwordHash,
        role: "ADMIN",
        agencyId,
        isVerified: false,
      });

      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationId = randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      console.log(`[SIGNUP] Generating OTP: code="${code}", expiresAt="${expiresAt}"`);

      await ctx.db.insert(emailVerification).values({
        id: verificationId,
        email: email,
        code,
        expiresAt,
      });

      // Send the email verification
      console.log(`[SIGNUP] Dispatching verification email to "${email}"`);
      await sendEmailVerification({
        to: email,
        name: input.name,
        code,
      });

      return {
        needsVerification: true,
        email: email,
      };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      console.log(`[LOGIN] Attempting login for email="${email}"`);

      const member = await ctx.db.query.teamMember.findFirst({
        where: (m, { eq }) => eq(m.email, email),
        with: { agency: true },
      });

      if (!member) {
        console.log(`[LOGIN] User not found: email="${email}"`);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      const isValid = await bcrypt.compare(input.password, member.passwordHash);
      if (!isValid) {
        console.log(`[LOGIN] Password mismatch for email="${email}"`);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      if (!member.isVerified) {
        console.log(`[LOGIN] User not verified: email="${email}". Triggering OTP generation.`);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationId = randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        await ctx.db.insert(emailVerification).values({
          id: verificationId,
          email: member.email,
          code,
          expiresAt,
        });

        await sendEmailVerification({
          to: member.email,
          name: member.name,
          code,
        });

        return {
          needsVerification: true,
          email: member.email,
        };
      }

      const token = jwt.sign(
        { userId: member.id, email: member.email, agencyId: member.agencyId, role: member.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      console.log(`[LOGIN] Successful login for email="${email}"`);
      return {
        needsVerification: false,
        token,
        user: { id: member.id, name: member.name, email: member.email, role: member.role },
        agency: {
          id: member.agency.id,
          name: member.agency.name,
          logoUrl: member.agency.logoUrl,
          currency: member.agency.currency,
        },
      };
    }),

  verifyOtp: publicProcedure
    .input(z.object({ email: z.string().email(), code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      console.log(`[VERIFY_OTP] Attempting verification for email="${email}", code="${input.code}"`);

      const records = await ctx.db
        .select()
        .from(emailVerification)
        .where(
          and(
            eq(emailVerification.email, email),
            eq(emailVerification.code, input.code)
          )
        )
        .limit(1);

      const record = records[0];

      if (!record || new Date(record.expiresAt) < new Date()) {
        console.log(`[VERIFY_OTP] Failed: recordFound=${!!record}, expired=${record ? new Date(record.expiresAt) < new Date() : "N/A"}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification code.",
        });
      }

      console.log(`[VERIFY_OTP] Verification code match. Updating teamMember isVerified to true.`);
      await ctx.db
        .update(teamMember)
        .set({ isVerified: true })
        .where(eq(teamMember.email, email));

      const member = await ctx.db.query.teamMember.findFirst({
        where: (m, { eq }) => eq(m.email, email),
        with: { agency: true },
      });

      if (!member) {
        console.log(`[VERIFY_OTP] Error: user not found after updating isVerified: email="${email}"`);
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      const token = jwt.sign(
        { userId: member.id, email: member.email, agencyId: member.agencyId, role: member.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      console.log(`[VERIFY_OTP] Success for email="${email}". Token issued.`);
      return {
        token,
        user: { id: member.id, name: member.name, email: member.email, role: member.role },
        agency: {
          id: member.agency.id,
          name: member.agency.name,
        },
      };
    }),

  resendOtp: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      console.log(`[RESEND_OTP] Requested for email="${email}"`);

      const member = await ctx.db.query.teamMember.findFirst({
        where: (m, { eq }) => eq(m.email, email),
      });

      if (!member) {
        console.log(`[RESEND_OTP] User not found in database for email="${email}"`);
        const allMembers = await ctx.db.select().from(teamMember);
        console.log(`[RESEND_OTP] Existing records in database:`, allMembers.map(m => m.email));
        throw new TRPCError({ code: "NOT_FOUND", message: `User not found for email: ${email}` });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationId = randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      console.log(`[RESEND_OTP] Generated new code="${code}" for email="${email}"`);

      await ctx.db.insert(emailVerification).values({
        id: verificationId,
        email: email,
        code,
        expiresAt,
      });

      await sendEmailVerification({
        to: email,
        name: member.name,
        code,
      });

      return { success: true };
    }),

  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      console.log(`[FORGOT_PWD] Requested for email="${email}"`);

      const member = await ctx.db.query.teamMember.findFirst({
        where: (m, { eq }) => eq(m.email, email),
      });

      if (!member) {
        console.log(`[FORGOT_PWD] User not found for email="${email}". Returning success to prevent email enumeration.`);
        return { success: true };
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationId = randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      console.log(`[FORGOT_PWD] Generated code="${code}" for email="${email}"`);

      await ctx.db.insert(emailVerification).values({
        id: verificationId,
        email: email,
        code,
        expiresAt,
      });

      await sendPasswordResetEmail({
        to: email,
        name: member.name,
        code,
      });

      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase().trim();
      console.log(`[RESET_PWD] Attempting for email="${email}", code="${input.code}"`);

      const records = await ctx.db
        .select()
        .from(emailVerification)
        .where(
          and(
            eq(emailVerification.email, email),
            eq(emailVerification.code, input.code)
          )
        )
        .limit(1);

      const record = records[0];

      if (!record || new Date(record.expiresAt) < new Date()) {
        console.log(`[RESET_PWD] Failed: invalid or expired code for email="${email}"`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification code.",
        });
      }

      const member = await ctx.db.query.teamMember.findFirst({
        where: (m, { eq }) => eq(m.email, email),
      });

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      await ctx.db
        .update(teamMember)
        .set({ passwordHash })
        .where(eq(teamMember.email, email));

      // Optional: Delete all OTPs for this email after successful reset
      await ctx.db
        .delete(emailVerification)
        .where(eq(emailVerification.email, email));

      console.log(`[RESET_PWD] Success for email="${email}"`);
      return { success: true };
    }),
});
