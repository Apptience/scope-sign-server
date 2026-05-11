"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scopeCardRouter = void 0;
const server_1 = require("@trpc/server");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const schema_1 = require("../db/schema");
const trpc_1 = require("../trpc");
exports.scopeCardRouter = (0, trpc_1.router)({
    addSection: trpc_1.protectedProcedure
        .input(zod_1.z.object({ projectId: zod_1.z.string(), title: zod_1.z.string().min(1), order: zod_1.z.number().default(0) }))
        .mutation(async ({ input, ctx }) => {
        const { agencyId } = ctx.user;
        const proj = await ctx.db.query.project.findFirst({
            where: (p, { and, eq }) => and(eq(p.id, input.projectId), eq(p.agencyId, agencyId)),
        });
        if (!proj)
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const id = (0, crypto_1.randomUUID)();
        const now = new Date().toISOString();
        await ctx.db.insert(schema_1.section).values({ id, projectId: input.projectId, title: input.title, order: input.order, createdAt: now, updatedAt: now });
        return ctx.db.query.section.findFirst({ where: (s, { eq }) => eq(s.id, id) });
    }),
    updateSection: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string(), title: zod_1.z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
        const sec = await ctx.db.query.section.findFirst({
            where: (s, { eq }) => eq(s.id, input.id),
            with: { project: true },
        });
        if (!sec || sec.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Section not found." });
        }
        await ctx.db.update(schema_1.section).set({ title: input.title, updatedAt: new Date().toISOString() }).where((0, drizzle_orm_1.eq)(schema_1.section.id, input.id));
        return ctx.db.query.section.findFirst({ where: (s, { eq }) => eq(s.id, input.id) });
    }),
    deleteSection: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string() }))
        .mutation(async ({ input, ctx }) => {
        const sec = await ctx.db.query.section.findFirst({
            where: (s, { eq }) => eq(s.id, input.id),
            with: { project: true },
        });
        if (!sec || sec.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Section not found." });
        }
        // Detach scope cards
        await ctx.db.update(schema_1.scopeCard).set({ sectionId: null }).where((0, drizzle_orm_1.eq)(schema_1.scopeCard.sectionId, input.id));
        await ctx.db.delete(schema_1.section).where((0, drizzle_orm_1.eq)(schema_1.section.id, input.id));
        return { success: true };
    }),
    createCard: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        projectId: zod_1.z.string(),
        sectionId: zod_1.z.string().nullable().optional(),
        title: zod_1.z.string().min(1),
        description: zod_1.z.string(),
        icon: zod_1.z.string().default("Feature"),
        effort: zod_1.z.string().nullable().optional(),
        included: zod_1.z.array(zod_1.z.string()).default([]),
        excluded: zod_1.z.array(zod_1.z.string()).default([]),
        type: zod_1.z.enum(["IN_SCOPE", "OUT_OF_SCOPE"]).default("IN_SCOPE"),
        order: zod_1.z.number().default(0),
    }))
        .mutation(async ({ input, ctx }) => {
        const { agencyId } = ctx.user;
        const proj = await ctx.db.query.project.findFirst({
            where: (p, { and, eq }) => and(eq(p.id, input.projectId), eq(p.agencyId, agencyId)),
        });
        if (!proj)
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const id = (0, crypto_1.randomUUID)();
        const now = new Date().toISOString();
        await ctx.db.insert(schema_1.scopeCard).values({
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
    updateCard: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        id: zod_1.z.string(),
        sectionId: zod_1.z.string().nullable().optional(),
        title: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        icon: zod_1.z.string().optional(),
        effort: zod_1.z.string().nullable().optional(),
        included: zod_1.z.array(zod_1.z.string()).optional(),
        excluded: zod_1.z.array(zod_1.z.string()).optional(),
        type: zod_1.z.enum(["IN_SCOPE", "OUT_OF_SCOPE"]).optional(),
        status: zod_1.z.enum(["PENDING", "APPROVED", "QUESTION_ASKED", "ANSWERED", "CHANGE_REQUESTED"]).optional(),
        order: zod_1.z.number().optional(),
    }))
        .mutation(async ({ input, ctx }) => {
        const card = await ctx.db.query.scopeCard.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
            with: { project: true },
        });
        if (!card || card.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Scope card not found." });
        }
        const { id, included, excluded, ...rest } = input;
        const updateData = { ...rest, updatedAt: new Date().toISOString() };
        if (included !== undefined)
            updateData.included = JSON.stringify(included);
        if (excluded !== undefined)
            updateData.excluded = JSON.stringify(excluded);
        await ctx.db.update(schema_1.scopeCard).set(updateData).where((0, drizzle_orm_1.eq)(schema_1.scopeCard.id, id));
        return ctx.db.query.scopeCard.findFirst({ where: (c, { eq }) => eq(c.id, id) });
    }),
    deleteCard: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string() }))
        .mutation(async ({ input, ctx }) => {
        const card = await ctx.db.query.scopeCard.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
            with: { project: true },
        });
        if (!card || card.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Scope card not found." });
        }
        await ctx.db.delete(schema_1.scopeCard).where((0, drizzle_orm_1.eq)(schema_1.scopeCard.id, input.id));
        return { success: true };
    }),
    reorderCards: trpc_1.protectedProcedure
        .input(zod_1.z.object({ cards: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), order: zod_1.z.number(), sectionId: zod_1.z.string().nullable() })) }))
        .mutation(async ({ input, ctx }) => {
        const now = new Date().toISOString();
        for (const card of input.cards) {
            await ctx.db
                .update(schema_1.scopeCard)
                .set({ order: card.order, sectionId: card.sectionId, updatedAt: now })
                .where((0, drizzle_orm_1.eq)(schema_1.scopeCard.id, card.id));
        }
        return { success: true };
    }),
    reorderSections: trpc_1.protectedProcedure
        .input(zod_1.z.object({ sections: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), order: zod_1.z.number() })) }))
        .mutation(async ({ input, ctx }) => {
        const now = new Date().toISOString();
        for (const sec of input.sections) {
            await ctx.db
                .update(schema_1.section)
                .set({ order: sec.order, updatedAt: now })
                .where((0, drizzle_orm_1.eq)(schema_1.section.id, sec.id));
        }
        return { success: true };
    }),
    answerQuestion: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string(), reply: zod_1.z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
        const card = await ctx.db.query.scopeCard.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
            with: { project: true },
        });
        if (!card || card.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Scope card not found." });
        }
        const now = new Date().toISOString();
        await ctx.db
            .update(schema_1.scopeCard)
            .set({
            status: "ANSWERED",
            updatedAt: now,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.scopeCard.id, input.id));
        await ctx.db.insert(schema_1.cardMessage).values({
            id: (0, crypto_1.randomUUID)(),
            cardId: input.id,
            sender: "AGENCY",
            message: input.reply,
            createdAt: now,
        });
        return { success: true };
    }),
});
