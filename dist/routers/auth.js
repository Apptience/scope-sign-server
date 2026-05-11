"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const server_1 = require("@trpc/server");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../db/schema");
const trpc_1 = require("../trpc");
const email_service_1 = require("../services/email.service");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-change-in-production";
exports.authRouter = (0, trpc_1.router)({
    signup: trpc_1.publicProcedure
        .input(zod_1.z.object({
        name: zod_1.z.string().min(2),
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(6),
        agencyName: zod_1.z.string().min(2),
        country: zod_1.z.string().optional(),
        currency: zod_1.z.string().default("USD"),
    }))
        .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        console.log(`[SIGNUP] Input: email="${email}", name="${input.name}", agencyName="${input.agencyName}"`);
        const existing = await ctx.db.query.teamMember.findFirst({
            where: (m, { eq }) => eq(m.email, email),
        });
        if (existing) {
            console.log(`[SIGNUP] Conflict: email="${email}" already registered.`);
            throw new server_1.TRPCError({
                code: "CONFLICT",
                message: "This email is already registered. Log in instead.",
            });
        }
        const agencyId = (0, crypto_1.randomUUID)();
        console.log(`[SIGNUP] Creating agency: id="${agencyId}", name="${input.agencyName}"`);
        await ctx.db.insert(schema_1.agency).values({
            id: agencyId,
            name: input.agencyName,
            country: input.country,
            currency: input.currency,
        });
        const passwordHash = await bcryptjs_1.default.hash(input.password, 10);
        const memberId = (0, crypto_1.randomUUID)();
        console.log(`[SIGNUP] Creating teamMember: id="${memberId}", email="${email}"`);
        await ctx.db.insert(schema_1.teamMember).values({
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
        const verificationId = (0, crypto_1.randomUUID)();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        console.log(`[SIGNUP] Generating OTP: code="${code}", expiresAt="${expiresAt}"`);
        await ctx.db.insert(schema_1.emailVerification).values({
            id: verificationId,
            email: email,
            code,
            expiresAt,
        });
        // Send the email verification
        console.log(`[SIGNUP] Dispatching verification email to "${email}"`);
        await (0, email_service_1.sendEmailVerification)({
            to: email,
            name: input.name,
            code,
        });
        return {
            needsVerification: true,
            email: email,
        };
    }),
    login: trpc_1.publicProcedure
        .input(zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string() }))
        .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        console.log(`[LOGIN] Attempting login for email="${email}"`);
        const member = await ctx.db.query.teamMember.findFirst({
            where: (m, { eq }) => eq(m.email, email),
            with: { agency: true },
        });
        if (!member) {
            console.log(`[LOGIN] User not found: email="${email}"`);
            throw new server_1.TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }
        const isValid = await bcryptjs_1.default.compare(input.password, member.passwordHash);
        if (!isValid) {
            console.log(`[LOGIN] Password mismatch for email="${email}"`);
            throw new server_1.TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }
        if (!member.isVerified) {
            console.log(`[LOGIN] User not verified: email="${email}". Triggering OTP generation.`);
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const verificationId = (0, crypto_1.randomUUID)();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            await ctx.db.insert(schema_1.emailVerification).values({
                id: verificationId,
                email: member.email,
                code,
                expiresAt,
            });
            await (0, email_service_1.sendEmailVerification)({
                to: member.email,
                name: member.name,
                code,
            });
            return {
                needsVerification: true,
                email: member.email,
            };
        }
        const token = jsonwebtoken_1.default.sign({ userId: member.id, email: member.email, agencyId: member.agencyId, role: member.role }, JWT_SECRET, { expiresIn: "7d" });
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
    verifyOtp: trpc_1.publicProcedure
        .input(zod_1.z.object({ email: zod_1.z.string().email(), code: zod_1.z.string().length(6) }))
        .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        console.log(`[VERIFY_OTP] Attempting verification for email="${email}", code="${input.code}"`);
        const records = await ctx.db
            .select()
            .from(schema_1.emailVerification)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.emailVerification.email, email), (0, drizzle_orm_1.eq)(schema_1.emailVerification.code, input.code)))
            .limit(1);
        const record = records[0];
        if (!record || new Date(record.expiresAt) < new Date()) {
            console.log(`[VERIFY_OTP] Failed: recordFound=${!!record}, expired=${record ? new Date(record.expiresAt) < new Date() : "N/A"}`);
            throw new server_1.TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid or expired verification code.",
            });
        }
        console.log(`[VERIFY_OTP] Verification code match. Updating teamMember isVerified to true.`);
        await ctx.db
            .update(schema_1.teamMember)
            .set({ isVerified: true })
            .where((0, drizzle_orm_1.eq)(schema_1.teamMember.email, email));
        const member = await ctx.db.query.teamMember.findFirst({
            where: (m, { eq }) => eq(m.email, email),
            with: { agency: true },
        });
        if (!member) {
            console.log(`[VERIFY_OTP] Error: user not found after updating isVerified: email="${email}"`);
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "User not found." });
        }
        const token = jsonwebtoken_1.default.sign({ userId: member.id, email: member.email, agencyId: member.agencyId, role: member.role }, JWT_SECRET, { expiresIn: "7d" });
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
    resendOtp: trpc_1.publicProcedure
        .input(zod_1.z.object({ email: zod_1.z.string().email() }))
        .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        console.log(`[RESEND_OTP] Requested for email="${email}"`);
        const member = await ctx.db.query.teamMember.findFirst({
            where: (m, { eq }) => eq(m.email, email),
        });
        if (!member) {
            console.log(`[RESEND_OTP] User not found in database for email="${email}"`);
            const allMembers = await ctx.db.select().from(schema_1.teamMember);
            console.log(`[RESEND_OTP] Existing records in database:`, allMembers.map(m => m.email));
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: `User not found for email: ${email}` });
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationId = (0, crypto_1.randomUUID)();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        console.log(`[RESEND_OTP] Generated new code="${code}" for email="${email}"`);
        await ctx.db.insert(schema_1.emailVerification).values({
            id: verificationId,
            email: email,
            code,
            expiresAt,
        });
        await (0, email_service_1.sendEmailVerification)({
            to: email,
            name: member.name,
            code,
        });
        return { success: true };
    }),
    forgotPassword: trpc_1.publicProcedure
        .input(zod_1.z.object({ email: zod_1.z.string().email() }))
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
        const verificationId = (0, crypto_1.randomUUID)();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        console.log(`[FORGOT_PWD] Generated code="${code}" for email="${email}"`);
        await ctx.db.insert(schema_1.emailVerification).values({
            id: verificationId,
            email: email,
            code,
            expiresAt,
        });
        await (0, email_service_1.sendPasswordResetEmail)({
            to: email,
            name: member.name,
            code,
        });
        return { success: true };
    }),
    resetPassword: trpc_1.publicProcedure
        .input(zod_1.z.object({
        email: zod_1.z.string().email(),
        code: zod_1.z.string().length(6),
        newPassword: zod_1.z.string().min(6),
    }))
        .mutation(async ({ input, ctx }) => {
        const email = input.email.toLowerCase().trim();
        console.log(`[RESET_PWD] Attempting for email="${email}", code="${input.code}"`);
        const records = await ctx.db
            .select()
            .from(schema_1.emailVerification)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.emailVerification.email, email), (0, drizzle_orm_1.eq)(schema_1.emailVerification.code, input.code)))
            .limit(1);
        const record = records[0];
        if (!record || new Date(record.expiresAt) < new Date()) {
            console.log(`[RESET_PWD] Failed: invalid or expired code for email="${email}"`);
            throw new server_1.TRPCError({
                code: "BAD_REQUEST",
                message: "Invalid or expired verification code.",
            });
        }
        const member = await ctx.db.query.teamMember.findFirst({
            where: (m, { eq }) => eq(m.email, email),
        });
        if (!member) {
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "User not found." });
        }
        const passwordHash = await bcryptjs_1.default.hash(input.newPassword, 10);
        await ctx.db
            .update(schema_1.teamMember)
            .set({ passwordHash })
            .where((0, drizzle_orm_1.eq)(schema_1.teamMember.email, email));
        // Optional: Delete all OTPs for this email after successful reset
        await ctx.db
            .delete(schema_1.emailVerification)
            .where((0, drizzle_orm_1.eq)(schema_1.emailVerification.email, email));
        console.log(`[RESET_PWD] Success for email="${email}"`);
        return { success: true };
    }),
});
