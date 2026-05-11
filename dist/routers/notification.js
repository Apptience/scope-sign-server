"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../db/schema");
const trpc_1 = require("../trpc");
exports.notificationRouter = (0, trpc_1.router)({
    getLatest: trpc_1.protectedProcedure.query(async ({ ctx }) => {
        const { agencyId } = ctx.user;
        const rows = await ctx.db.query.notification.findMany({
            where: (n, { eq }) => eq(n.agencyId, agencyId),
            orderBy: (n, { desc }) => [desc(n.createdAt)],
            limit: 5,
            with: {
                project: {
                    columns: {
                        name: true,
                    },
                },
            },
        });
        const unreadCount = await ctx.db.query.notification.findMany({
            where: (n, { and, eq }) => and(eq(n.agencyId, agencyId), eq(n.isRead, false)),
        }).then(items => items.length);
        return {
            notifications: rows,
            unreadCount,
        };
    }),
    markAllAsRead: trpc_1.protectedProcedure.mutation(async ({ ctx }) => {
        const { agencyId } = ctx.user;
        await ctx.db
            .update(schema_1.notification)
            .set({ isRead: true })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notification.agencyId, agencyId), (0, drizzle_orm_1.eq)(schema_1.notification.isRead, false)));
        return { success: true };
    }),
});
