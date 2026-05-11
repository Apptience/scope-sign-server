import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { activityLog, changeRequest, notification, scopeCard } from "../db/schema";
import { magicLinkProcedure, protectedProcedure, router } from "../trpc";

export const changeRequestRouter = router({
  submit: magicLinkProcedure
    .input(
      z.object({
        clientRequest: z.string().min(1),
        scopeCardId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = randomUUID();
      const now = new Date().toISOString();

      // 1. Create the change request record
      await ctx.db.insert(changeRequest).values({
        id,
        projectId: ctx.project.id,
        scopeCardId: input.scopeCardId || null,
        status: "NEW",
        clientRequest: input.clientRequest,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Atomically escalate the state of the linked card to CHANGE_REQUESTED
      if (input.scopeCardId) {
        await ctx.db.update(scopeCard)
          .set({ status: "CHANGE_REQUESTED", updatedAt: now })
          .where(eq(scopeCard.id, input.scopeCardId));
      }

      await ctx.db.insert(notification).values({
        id: randomUUID(),
        agencyId: ctx.project.agencyId,
        projectId: ctx.project.id,
        content: `New Change Request submitted by ${ctx.project.clientName} for project "${ctx.project.name}"`,
        isRead: false,
        createdAt: now,
      });

      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
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
      return result!;
    }),

  price: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        agencyResponse: z.string().min(1),
        additionalEffort: z.string().optional(),
        additionalCost: z.number().optional(),
        timelineImpactDays: z.number().optional().default(0),
        internalNotes: z.string().optional(),

        // Optional Card Redefinitions
        cardDescription: z.string().optional(),
        cardIncluded: z.array(z.string()).optional(),
        cardExcluded: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const cr = await ctx.db.query.changeRequest.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        with: { project: true },
      });

      if (!cr || cr.project.agencyId !== ctx.user.agencyId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Change request not found." });
      }

      const now = new Date().toISOString();

      // 1. Update primary change request metrics
      await ctx.db
        .update(changeRequest)
        .set({
          status: "PRICED",
          agencyResponse: input.agencyResponse,
          additionalEffort: input.additionalEffort ?? null,
          additionalCost: input.additionalCost ?? null,
          timelineImpactDays: input.timelineImpactDays,
          internalNotes: input.internalNotes ?? null,
          updatedAt: now,
        })
        .where(eq(changeRequest.id, input.id));

      // 2. Atomic Redefinition of Correlated ScopeCard contents
      if (cr.scopeCardId) {
        const cardUpdate: any = { updatedAt: now };
        if (input.cardDescription !== undefined) cardUpdate.description = input.cardDescription;
        if (input.cardIncluded !== undefined) cardUpdate.included = JSON.stringify(input.cardIncluded);
        if (input.cardExcluded !== undefined) cardUpdate.excluded = JSON.stringify(input.cardExcluded);

        if (Object.keys(cardUpdate).length > 1) {
          await ctx.db.update(scopeCard).set(cardUpdate).where(eq(scopeCard.id, cr.scopeCardId));
        }
      }

      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
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
      return updated!;
    }),

  clientDecision: magicLinkProcedure
    .input(
      z.object({
        id: z.string(),
        decision: z.enum(["APPROVED", "DECLINED"]),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const cr = await ctx.db.query.changeRequest.findFirst({
        where: (c, { and, eq }) => and(eq(c.id, input.id), eq(c.projectId, ctx.project.id)),
      });

      if (!cr) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change request not found.",
        });
      }

      const now = new Date().toISOString();

      await ctx.db
        .update(changeRequest)
        .set({
          status: input.decision,
          clientFeedback: input.feedback ?? null,
          updatedAt: now,
        })
        .where(eq(changeRequest.id, input.id));

      await ctx.db.insert(notification).values({
        id: randomUUID(),
        agencyId: ctx.project.agencyId,
        projectId: ctx.project.id,
        content: `Change Request for "${ctx.project.name}" was ${input.decision.toLowerCase()} by client.`,
        isRead: false,
        createdAt: now,
      });

      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
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
      return updated!;
    }),

  markAsInvoiced: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const cr = await ctx.db.query.changeRequest.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        with: { project: true },
      });

      if (!cr || cr.project.agencyId !== ctx.user.agencyId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Change request not found.",
        });
      }

      if (cr.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only approved change requests can be marked as invoiced.",
        });
      }

      const now = new Date().toISOString();

      await ctx.db
        .update(changeRequest)
        .set({ status: "INVOICED", updatedAt: now })
        .where(eq(changeRequest.id, input.id));

      const updated = await ctx.db.query.changeRequest.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
      });
      return updated!;
    }),
});
