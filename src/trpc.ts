import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { Context } from "./context";
import { magicLink } from "./db/schema";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware to require JWT Auth (Agency side)
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({
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

export const protectedProcedure = t.procedure.use(isAuthed);

// Middleware to require Magic Link validation (Client side)
const isMagicLinkValid = t.middleware(async ({ next, ctx }) => {
  const token = ctx.req.headers["x-magic-token"] as string;

  if (!token) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Magic token is missing.",
    });
  }

  const rows = await ctx.db
    .select()
    .from(magicLink)
    .where(eq(magicLink.token, token))
    .limit(1);

  const link = rows[0];

  if (!link || !link.isActive || new Date(link.expiresAt) < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The magic link has expired or is invalid.",
    });
  }

  // Fetch project for this magic link
  const projectRows = await ctx.db.query.project.findFirst({
    where: (p, { eq }) => eq(p.id, link.projectId),
  });

  if (!projectRows) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  }

  return next({
    ctx: {
      ...ctx,
      project: projectRows,
    },
  });
});

export const magicLinkProcedure = t.procedure.use(isMagicLinkValid);
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;
