"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeRequestRouter = void 0;
const server_1 = require("@trpc/server");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const schema_1 = require("../db/schema");
const trpc_1 = require("../trpc");
exports.changeRequestRouter = (0, trpc_1.router)({
    submit: trpc_1.magicLinkProcedure
        .input(zod_1.z.object({
        clientRequest: zod_1.z.string().min(1),
    }))
        .mutation(async ({ input, ctx }) => {
        if (ctx.project.status !== "SIGNED") {
            throw new server_1.TRPCError({
                code: "FORBIDDEN",
                message: "Change requests can only be submitted after the initial scope has been signed off.",
            });
        }
        const id = (0, crypto_1.randomUUID)();
        const now = new Date().toISOString();
        await ctx.db.insert(schema_1.changeRequest).values({
            id,
            projectId: ctx.project.id,
            status: "NEW",
            clientRequest: input.clientRequest,
            createdAt: now,
            updatedAt: now,
        });
        await ctx.db.insert(schema_1.notification).values({
            id: (0, crypto_1.randomUUID)(),
            projectId: ctx.project.id,
            content: `New Change Request submitted by ${ctx.project.clientName} for project "${ctx.project.name}"`,
            isRead: false,
            createdAt: now,
        });
        await ctx.db.insert(schema_1.activityLog).values({
            id: (0, crypto_1.randomUUID)(),
            projectId: ctx.project.id,
            action: "CHANGE_REQUEST_SUBMITTED",
            details: JSON.stringify({
                changeRequestId: id,
                clientRequest: input.clientRequest,
            }),
            createdAt: now,
        });
        const result = await ctx.db.query.changeRequest.findFirst({
            where: (c, { eq }) => eq(c.id, id),
        });
        return result;
    }),
    price: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        id: zod_1.z.string(),
        agencyResponse: zod_1.z.string().min(1),
        additionalEffort: zod_1.z.string().optional(),
        additionalCost: zod_1.z.number().optional(),
        timelineImpactDays: zod_1.z.number().default(0),
        internalNotes: zod_1.z.string().optional(),
    }))
        .mutation(async ({ input, ctx }) => {
        const cr = await ctx.db.query.changeRequest.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
            with: { project: true },
        });
        if (!cr || cr.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({
                code: "NOT_FOUND",
                message: "Change request not found.",
            });
        }
        const now = new Date().toISOString();
        await ctx.db
            .update(schema_1.changeRequest)
            .set({
            status: "PRICED",
            agencyResponse: input.agencyResponse,
            additionalEffort: input.additionalEffort ?? null,
            additionalCost: input.additionalCost ?? null,
            timelineImpactDays: input.timelineImpactDays,
            internalNotes: input.internalNotes ?? null,
            updatedAt: now,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.changeRequest.id, input.id));
        await ctx.db.insert(schema_1.activityLog).values({
            id: (0, crypto_1.randomUUID)(),
            projectId: cr.projectId,
            action: "CHANGE_REQUEST_PRICED",
            details: JSON.stringify({
                changeRequestId: cr.id,
                cost: input.additionalCost,
                effort: input.additionalEffort,
            }),
            createdAt: now,
        });
        const updated = await ctx.db.query.changeRequest.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
        });
        return updated;
    }),
    clientDecision: trpc_1.magicLinkProcedure
        .input(zod_1.z.object({
        id: zod_1.z.string(),
        decision: zod_1.z.enum(["APPROVED", "DECLINED"]),
        feedback: zod_1.z.string().optional(),
    }))
        .mutation(async ({ input, ctx }) => {
        const cr = await ctx.db.query.changeRequest.findFirst({
            where: (c, { and, eq }) => and(eq(c.id, input.id), eq(c.projectId, ctx.project.id)),
        });
        if (!cr) {
            throw new server_1.TRPCError({
                code: "NOT_FOUND",
                message: "Change request not found.",
            });
        }
        const now = new Date().toISOString();
        await ctx.db
            .update(schema_1.changeRequest)
            .set({
            status: input.decision,
            clientFeedback: input.feedback ?? null,
            updatedAt: now,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.changeRequest.id, input.id));
        await ctx.db.insert(schema_1.notification).values({
            id: (0, crypto_1.randomUUID)(),
            projectId: ctx.project.id,
            content: `Change Request for "${ctx.project.name}" was ${input.decision.toLowerCase()} by client.`,
            isRead: false,
            createdAt: now,
        });
        await ctx.db.insert(schema_1.activityLog).values({
            id: (0, crypto_1.randomUUID)(),
            projectId: ctx.project.id,
            action: `CHANGE_REQUEST_${input.decision}`,
            details: JSON.stringify({
                changeRequestId: cr.id,
                feedback: input.feedback,
            }),
            createdAt: now,
        });
        const updated = await ctx.db.query.changeRequest.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
        });
        return updated;
    }),
    markAsInvoiced: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string() }))
        .mutation(async ({ input, ctx }) => {
        const cr = await ctx.db.query.changeRequest.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
            with: { project: true },
        });
        if (!cr || cr.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({
                code: "NOT_FOUND",
                message: "Change request not found.",
            });
        }
        if (cr.status !== "APPROVED") {
            throw new server_1.TRPCError({
                code: "BAD_REQUEST",
                message: "Only approved change requests can be marked as invoiced.",
            });
        }
        const now = new Date().toISOString();
        await ctx.db
            .update(schema_1.changeRequest)
            .set({ status: "INVOICED", updatedAt: now })
            .where((0, drizzle_orm_1.eq)(schema_1.changeRequest.id, input.id));
        const updated = await ctx.db.query.changeRequest.findFirst({
            where: (c, { eq }) => eq(c.id, input.id),
        });
        return updated;
    }),
});
