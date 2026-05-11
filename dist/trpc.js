"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeRouters = exports.middleware = exports.magicLinkProcedure = exports.protectedProcedure = exports.publicProcedure = exports.router = void 0;
const server_1 = require("@trpc/server");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("./db/schema");
const t = server_1.initTRPC.context().create();
exports.router = t.router;
exports.publicProcedure = t.procedure;
// Middleware to require JWT Auth (Agency side)
const isAuthed = t.middleware(({ next, ctx }) => {
    if (!ctx.user) {
        throw new server_1.TRPCError({
            code: "UNAUTHORIZED",
            message: "You must be logged in to perform this action.",
        });
    }
    return next({
        ctx: {
            user: ctx.user,
        },
    });
});
exports.protectedProcedure = t.procedure.use(isAuthed);
// Middleware to require Magic Link validation (Client side)
const isMagicLinkValid = t.middleware(async ({ next, ctx }) => {
    const token = ctx.req.headers["x-magic-token"];
    if (!token) {
        throw new server_1.TRPCError({
            code: "UNAUTHORIZED",
            message: "Magic token is missing.",
        });
    }
    const rows = await ctx.db
        .select()
        .from(schema_1.magicLink)
        .where((0, drizzle_orm_1.eq)(schema_1.magicLink.token, token))
        .limit(1);
    const link = rows[0];
    if (!link || !link.isActive || new Date(link.expiresAt) < new Date()) {
        throw new server_1.TRPCError({
            code: "FORBIDDEN",
            message: "The magic link has expired or is invalid.",
        });
    }
    // Fetch project for this magic link
    const projectRows = await ctx.db.query.project.findFirst({
        where: (p, { eq }) => eq(p.id, link.projectId),
    });
    if (!projectRows) {
        throw new server_1.TRPCError({ code: "NOT_FOUND", message: "Project not found." });
    }
    return next({
        ctx: {
            ...ctx,
            project: projectRows,
        },
    });
});
exports.magicLinkProcedure = t.procedure.use(isMagicLinkValid);
exports.middleware = t.middleware;
exports.mergeRouters = t.mergeRouters;
