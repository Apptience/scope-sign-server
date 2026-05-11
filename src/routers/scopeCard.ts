import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { scopeCard, section, cardMessage } from "../db/schema";
import { protectedProcedure, router } from "../trpc";

export const scopeCardRouter = router({
  addSection: protectedProcedure
    .input(z.object({ projectId: z.string(), title: z.string().min(1), order: z.number().default(0) }))
    .mutation(async ({ input, ctx }) => {
      const { agencyId } = ctx.user;
      const proj = await ctx.db.query.project.findFirst({
        where: (p, { and, eq }) => and(eq(p.id, input.projectId), eq(p.agencyId, agencyId)),
      });
      if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

      const id = randomUUID();
      const now = new Date().toISOString();
      await ctx.db.insert(section).values({ id, projectId: input.projectId, title: input.title, order: input.order, createdAt: now, updatedAt: now });
      return ctx.db.query.section.findFirst({ where: (s, { eq }) => eq(s.id, id) });
    }),

  updateSection: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const sec = await ctx.db.query.section.findFirst({
        where: (s, { eq }) => eq(s.id, input.id),
        with: { project: true },
      });
      if (!sec || sec.project.agencyId !== ctx.user.agencyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Section not found." });
      }
      await ctx.db.update(section).set({ title: input.title, updatedAt: new Date().toISOString() }).where(eq(section.id, input.id));
      return ctx.db.query.section.findFirst({ where: (s, { eq }) => eq(s.id, input.id) });
    }),

  deleteSection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const sec = await ctx.db.query.section.findFirst({
        where: (s, { eq }) => eq(s.id, input.id),
        with: { project: true },
      });
      if (!sec || sec.project.agencyId !== ctx.user.agencyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Section not found." });
      }
      // Detach scope cards
      await ctx.db.update(scopeCard).set({ sectionId: null }).where(eq(scopeCard.sectionId, input.id));
      await ctx.db.delete(section).where(eq(section.id, input.id));
      return { success: true };
    }),

  createCard: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        sectionId: z.string().nullable().optional(),
        title: z.string().min(1),
        description: z.string(),
        icon: z.string().default("Feature"),
        effort: z.string().nullable().optional(),
        included: z.array(z.string()).default([]),
        excluded: z.array(z.string()).default([]),
        type: z.enum(["IN_SCOPE", "OUT_OF_SCOPE"]).default("IN_SCOPE"),
        order: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { agencyId } = ctx.user;
      const proj = await ctx.db.query.project.findFirst({
        where: (p, { and, eq }) => and(eq(p.id, input.projectId), eq(p.agencyId, agencyId)),
      });
      if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

      const id = randomUUID();
      const now = new Date().toISOString();
      await ctx.db.insert(scopeCard).values({
        id,
        projectId: input.projectId,
        sectionId: input.sectionId ?? null,
        title: input.title,
        description: input.description,
        icon: input.icon,
        effort: input.effort ?? null,
        included: JSON.stringify(input.included),
        excluded: JSON.stringify(input.excluded),
        type: input.type,
        order: input.order,
        createdAt: now,
        updatedAt: now,
      });
      return ctx.db.query.scopeCard.findFirst({ where: (c, { eq }) => eq(c.id, id) });
    }),

  updateCard: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        sectionId: z.string().nullable().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        effort: z.string().nullable().optional(),
        included: z.array(z.string()).optional(),
        excluded: z.array(z.string()).optional(),
        type: z.enum(["IN_SCOPE", "OUT_OF_SCOPE"]).optional(),
        status: z.enum(["PENDING", "APPROVED", "QUESTION_ASKED", "ANSWERED", "CHANGE_REQUESTED"]).optional(),
        order: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const card = await ctx.db.query.scopeCard.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        with: { project: true },
      });
      if (!card || card.project.agencyId !== ctx.user.agencyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scope card not found." });
      }

      const { id, included, excluded, ...rest } = input;
      const updateData: any = { ...rest, updatedAt: new Date().toISOString() };
      if (included !== undefined) updateData.included = JSON.stringify(included);
      if (excluded !== undefined) updateData.excluded = JSON.stringify(excluded);

      await ctx.db.update(scopeCard).set(updateData).where(eq(scopeCard.id, id));
      return ctx.db.query.scopeCard.findFirst({ where: (c, { eq }) => eq(c.id, id) });
    }),

  deleteCard: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const card = await ctx.db.query.scopeCard.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        with: { project: true },
      });
      if (!card || card.project.agencyId !== ctx.user.agencyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scope card not found." });
      }
      await ctx.db.delete(scopeCard).where(eq(scopeCard.id, input.id));
      return { success: true };
    }),

  reorderCards: protectedProcedure
    .input(z.object({ cards: z.array(z.object({ id: z.string(), order: z.number(), sectionId: z.string().nullable() })) }))
    .mutation(async ({ input, ctx }) => {
      const now = new Date().toISOString();
      for (const card of input.cards) {
        await ctx.db
          .update(scopeCard)
          .set({ order: card.order, sectionId: card.sectionId, updatedAt: now })
          .where(eq(scopeCard.id, card.id));
      }
      return { success: true };
    }),

  reorderSections: protectedProcedure
    .input(z.object({ sections: z.array(z.object({ id: z.string(), order: z.number() })) }))
    .mutation(async ({ input, ctx }) => {
      const now = new Date().toISOString();
      for (const sec of input.sections) {
        await ctx.db
          .update(section)
          .set({ order: sec.order, updatedAt: now })
          .where(eq(section.id, sec.id));
      }
      return { success: true };
    }),

  answerQuestion: protectedProcedure
    .input(z.object({ id: z.string(), reply: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const card = await ctx.db.query.scopeCard.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        with: { project: true },
      });
      if (!card || card.project.agencyId !== ctx.user.agencyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scope card not found." });
      }

      const now = new Date().toISOString();
      await ctx.db
        .update(scopeCard)
        .set({
          status: "ANSWERED",
          updatedAt: now,
        })
        .where(eq(scopeCard.id, input.id));

      await ctx.db.insert(cardMessage).values({
        id: randomUUID(),
        cardId: input.id,
        sender: "AGENCY",
        message: input.reply,
        createdAt: now,
      });

      return { success: true };
    }),
});
