import { eq, and } from "drizzle-orm";
import { notification } from "../db/schema";
import { protectedProcedure, router } from "../trpc";

export const notificationRouter = router({
  getLatest: protectedProcedure.query(async ({ ctx }) => {
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

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    const { agencyId } = ctx.user;

    await ctx.db
      .update(notification)
      .set({ isRead: true })
      .where(
        and(
          eq(notification.agencyId, agencyId),
          eq(notification.isRead, false)
        )
      );

    return { success: true };
  }),
});
