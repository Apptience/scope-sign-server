"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectRouter = void 0;
const server_1 = require("@trpc/server");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const schema_1 = require("../db/schema");
const trpc_1 = require("../trpc");
exports.projectRouter = (0, trpc_1.router)({
    create: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        name: zod_1.z.string().min(1),
        clientName: zod_1.z.string().min(1),
        clientEmail: zod_1.z.string().email(),
        clientCompany: zod_1.z.string().optional(),
        clientWhatsApp: zod_1.z.string().optional(),
        type: zod_1.z.enum(["SOFTWARE", "CREATIVE", "ARCHITECTURE", "CONSULTING", "OTHER"]).default("SOFTWARE"),
        currency: zod_1.z.string().default("USD"),
    }))
        .mutation(async ({ input, ctx }) => {
        console.log("[PROJECT_ROUTER] Creating project, user:", ctx.user, "input:", input);
        const { agencyId } = ctx.user;
        const id = (0, crypto_1.randomUUID)();
        const now = new Date().toISOString();
        try {
            await ctx.db.insert(schema_1.project).values({
                id,
                ...input,
                agencyId,
                status: "DRAFT",
                createdAt: now,
                updatedAt: now,
            });
            await ctx.db.insert(schema_1.activityLog).values({
                id: (0, crypto_1.randomUUID)(),
                projectId: id,
                action: "PROJECT_CREATED",
                details: JSON.stringify({ projectName: input.name }),
                createdAt: now,
            });
            const created = await ctx.db.query.project.findFirst({
                where: (p, { eq }) => eq(p.id, id),
            });
            console.log("[PROJECT_ROUTER] Successfully created project:", created);
            return created;
        }
        catch (err) {
            console.error("[PROJECT_ROUTER] Error creating project in database:", err);
            throw err;
        }
    }),
    list: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        search: zod_1.z.string().optional(),
        status: zod_1.z.string().optional(),
        type: zod_1.z.string().optional(),
    }))
        .query(async ({ input, ctx }) => {
        const { agencyId } = ctx.user;
        let conditions = [(0, drizzle_orm_1.eq)(schema_1.project.agencyId, agencyId)];
        if (input.status && input.status !== "ALL") {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.project.status, input.status));
        }
        if (input.type && input.type !== "ALL") {
            conditions.push((0, drizzle_orm_1.eq)(schema_1.project.type, input.type));
        }
        let rows = await ctx.db.query.project.findMany({
            where: (_, { and }) => and(...conditions),
            with: { scopeCards: { columns: { id: true, status: true } } },
            orderBy: (p, { desc }) => [desc(p.updatedAt)],
        });
        if (input.search) {
            const s = input.search.toLowerCase();
            rows = rows.filter((p) => p.name.toLowerCase().includes(s) ||
                p.clientName.toLowerCase().includes(s));
        }
        return rows.map((proj) => ({
            ...proj,
            totalCards: proj.scopeCards.length,
            approvedCards: proj.scopeCards.filter((c) => c.status === "APPROVED").length,
        }));
    }),
    getById: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string() }))
        .query(async ({ input, ctx }) => {
        const { agencyId } = ctx.user;
        const proj = await ctx.db.query.project.findFirst({
            where: (p, { and, eq }) => and(eq(p.id, input.id), eq(p.agencyId, agencyId)),
            with: {
                sections: {
                    orderBy: (s, { asc }) => [asc(s.order)],
                    with: {
                        scopeCards: {
                            orderBy: (c, { asc }) => [asc(c.order)],
                            with: {
                                messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] },
                            },
                        },
                    },
                },
                scopeCards: {
                    where: (c, { isNull }) => isNull(c.sectionId),
                    orderBy: (c, { asc }) => [asc(c.order)],
                    with: {
                        messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] },
                    },
                },
                magicLinks: { orderBy: (m, { desc }) => [desc(m.createdAt)], limit: 1 },
                activityLogs: { orderBy: (a, { desc }) => [desc(a.createdAt)] },
                notifications: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
                changeRequests: { orderBy: (cr, { desc }) => [desc(cr.createdAt)] },
            },
        });
        if (!proj) {
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Project not found or access denied." });
        }
        return proj;
    }),
    update: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string().optional(),
        clientName: zod_1.z.string().optional(),
        clientEmail: zod_1.z.string().email().optional(),
        clientCompany: zod_1.z.string().optional(),
        clientWhatsApp: zod_1.z.string().optional(),
        type: zod_1.z.enum(["SOFTWARE", "CREATIVE", "ARCHITECTURE", "CONSULTING", "OTHER"]).optional(),
        currency: zod_1.z.string().optional(),
        status: zod_1.z.enum(["DRAFT", "SENT", "IN_REVIEW", "APPROVED", "SIGNED", "ARCHIVED"]).optional(),
    }))
        .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const { agencyId } = ctx.user;
        const existing = await ctx.db.query.project.findFirst({
            where: (p, { and, eq }) => and(eq(p.id, id), eq(p.agencyId, agencyId)),
        });
        if (!existing)
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        await ctx.db
            .update(schema_1.project)
            .set({ ...data, updatedAt: new Date().toISOString() })
            .where((0, drizzle_orm_1.eq)(schema_1.project.id, id));
        return ctx.db.query.project.findFirst({ where: (p, { eq }) => eq(p.id, id) });
    }),
    archive: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string() }))
        .mutation(async ({ input, ctx }) => {
        const { agencyId } = ctx.user;
        const now = new Date().toISOString();
        const existing = await ctx.db.query.project.findFirst({
            where: (p, { and, eq }) => and(eq(p.id, input.id), eq(p.agencyId, agencyId)),
        });
        if (!existing)
            throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        await ctx.db
            .update(schema_1.project)
            .set({ status: "ARCHIVED", updatedAt: now })
            .where((0, drizzle_orm_1.eq)(schema_1.project.id, input.id));
        await ctx.db.insert(schema_1.activityLog).values({
            id: (0, crypto_1.randomUUID)(),
            projectId: input.id,
            action: "PROJECT_ARCHIVED",
            details: JSON.stringify({ projectName: existing.name }),
            createdAt: now,
        });
        return ctx.db.query.project.findFirst({ where: (p, { eq }) => eq(p.id, input.id) });
    }),
    getStats: trpc_1.protectedProcedure.query(async ({ ctx }) => {
        const { agencyId } = ctx.user;
        const projects = await ctx.db.query.project.findMany({
            where: (p, { eq }) => eq(p.agencyId, agencyId),
            with: {
                scopeCards: { columns: { status: true } },
                changeRequests: { columns: { status: true } },
            },
        });
        const activeCount = projects.filter((p) => p.status !== "ARCHIVED").length;
        const pendingApprovalsCount = projects.filter((p) => p.status === "IN_REVIEW" || p.status === "SENT").length;
        let totalChangeRequests = 0;
        projects.forEach((p) => {
            totalChangeRequests += p.changeRequests.filter((cr) => cr.status === "NEW" || cr.status === "PRICED").length;
        });
        const signedProjects = projects.filter((p) => p.status === "SIGNED" && p.signedAt);
        let avgApprovalTimeDays = 3;
        if (signedProjects.length > 0) {
            const totalTimeMs = signedProjects.reduce((acc, proj) => {
                const duration = new Date(proj.signedAt).getTime() - new Date(proj.createdAt).getTime();
                return acc + duration;
            }, 0);
            avgApprovalTimeDays = Math.round(totalTimeMs / (1000 * 60 * 60 * 24) / signedProjects.length);
        }
        return {
            activeProjects: activeCount,
            pendingApprovals: pendingApprovalsCount,
            openChangeRequests: totalChangeRequests,
            avgApprovalTime: avgApprovalTimeDays,
        };
    }),
});
