"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.magicLinkRouter = void 0;
const server_1 = require("@trpc/server");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const crypto_2 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const schema_1 = require("../db/schema");
const trpc_1 = require("../trpc");
exports.magicLinkRouter = (0, trpc_1.router)({
    generate: trpc_1.protectedProcedure
        .input(zod_1.z.object({
        projectId: zod_1.z.string(),
        expiresInDays: zod_1.z.number().default(90),
    }))
        .mutation(async ({ input, ctx }) => {
        const { agencyId } = ctx.user;
        const proj = await ctx.db.query.project.findFirst({
            where: (p, { and, eq }) => and(eq(p.id, input.projectId), eq(p.agencyId, agencyId)),
        });
        if (!proj) {
            throw new server_1.TRPCError({
                code: "NOT_FOUND",
                message: "Project not found.",
            });
        }
        // Deactivate any existing magic links for this project
        await ctx.db
            .update(schema_1.magicLink)
            .set({ isActive: false, updatedAt: new Date().toISOString() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.magicLink.projectId, input.projectId), (0, drizzle_orm_1.eq)(schema_1.magicLink.isActive, true)));
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let token = "";
        const bytes = crypto_2.default.randomBytes(8);
        for (let i = 0; i < 8; i++) {
            token += chars[bytes[i] % chars.length];
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
        const now = new Date().toISOString();
        const id = (0, crypto_1.randomUUID)();
        await ctx.db.insert(schema_1.magicLink).values({
            id,
            projectId: input.projectId,
            token,
            expiresAt: expiresAt.toISOString(),
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });
        // Update project status to SENT if it was DRAFT
        if (proj.status === "DRAFT") {
            await ctx.db
                .update(schema_1.project)
                .set({ status: "SENT", updatedAt: now })
                .where((0, drizzle_orm_1.eq)(schema_1.project.id, input.projectId));
        }
        await ctx.db.insert(schema_1.activityLog).values({
            id: (0, crypto_1.randomUUID)(),
            projectId: proj.id,
            action: "MAGIC_LINK_GENERATED",
            details: JSON.stringify({ token, expiresAt: expiresAt.toISOString() }),
            createdAt: now,
        });
        const result = await ctx.db.query.magicLink.findFirst({
            where: (m, { eq }) => eq(m.id, id),
        });
        return result;
    }),
    revoke: trpc_1.protectedProcedure
        .input(zod_1.z.object({ id: zod_1.z.string() }))
        .mutation(async ({ input, ctx }) => {
        const link = await ctx.db.query.magicLink.findFirst({
            where: (m, { eq }) => eq(m.id, input.id),
            with: { project: true },
        });
        if (!link || link.project.agencyId !== ctx.user.agencyId) {
            throw new server_1.TRPCError({
                code: "NOT_FOUND",
                message: "Magic link not found.",
            });
        }
        await ctx.db
            .update(schema_1.magicLink)
            .set({ isActive: false, updatedAt: new Date().toISOString() })
            .where((0, drizzle_orm_1.eq)(schema_1.magicLink.id, input.id));
        const updated = await ctx.db.query.magicLink.findFirst({
            where: (m, { eq }) => eq(m.id, input.id),
        });
        return updated;
    }),
});
