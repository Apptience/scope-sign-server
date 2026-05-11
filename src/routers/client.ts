import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { activityLog, notification, project, scopeCard, changeRequest, cardMessage } from "../db/schema";
import { magicLinkProcedure, router } from "../trpc";

export const clientRouter = router({
  getBoard: magicLinkProcedure.query(async ({ ctx }) => {
    const proj = await ctx.db.query.project.findFirst({
      where: (p, { eq }) => eq(p.id, ctx.project.id),
      with: {
        agency: true,
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
        changeRequests: {
          orderBy: (c, { desc }) => [desc(c.createdAt)]
        },
      },
    });

    return proj || null;
  }),

  approveCard: magicLinkProcedure
    .input(z.object({ cardId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const card = await ctx.db.query.scopeCard.findFirst({
        where: (c, { and, eq }) => and(eq(c.id, input.cardId), eq(c.projectId, ctx.project.id)),
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scope card not found in this project.",
        });
      }

      await ctx.db
        .update(scopeCard)
        .set({ status: "APPROVED", updatedAt: new Date().toISOString() })
        .where(eq(scopeCard.id, input.cardId));

      const now = new Date().toISOString();

      // Log activity
      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
        projectId: ctx.project.id,
        action: "CARD_APPROVED",
        details: JSON.stringify({
          cardId: card.id,
          cardTitle: card.title,
          clientName: ctx.project.clientName,
        }),
        createdAt: now,
      });

      // Update project status to IN_REVIEW if it was SENT
      if (ctx.project.status === "SENT") {
        await ctx.db
          .update(project)
          .set({ status: "IN_REVIEW", updatedAt: now })
          .where(eq(project.id, ctx.project.id));
      }

      const updated = await ctx.db.query.scopeCard.findFirst({
        where: (c, { eq }) => eq(c.id, input.cardId),
      });
      return updated!;
    }),

  askQuestion: magicLinkProcedure
    .input(
      z.object({
        cardId: z.string(),
        question: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const card = await ctx.db.query.scopeCard.findFirst({
        where: (c, { and, eq }) => and(eq(c.id, input.cardId), eq(c.projectId, ctx.project.id)),
      });

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scope card not found in this project.",
        });
      }

      const now = new Date().toISOString();

      await ctx.db
        .update(scopeCard)
        .set({ status: "QUESTION_ASKED", updatedAt: now })
        .where(eq(scopeCard.id, input.cardId));

      await ctx.db.insert(cardMessage).values({
        id: randomUUID(),
        cardId: input.cardId,
        sender: "CLIENT",
        message: input.question,
        createdAt: now,
      });

      // Create in-app notification
      await ctx.db.insert(notification).values({
        id: randomUUID(),
        agencyId: ctx.project.agencyId,
        projectId: ctx.project.id,
        content: `${ctx.project.clientName} asked a question on feature "${card.title}": "${input.question.substring(0, 60)}..."`,
        isRead: false,
        createdAt: now,
      });

      // Log activity
      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
        projectId: ctx.project.id,
        action: "QUESTION_ASKED",
        details: JSON.stringify({
          cardId: card.id,
          cardTitle: card.title,
          question: input.question,
          clientName: ctx.project.clientName,
        }),
        createdAt: now,
      });

      const updated = await ctx.db.query.scopeCard.findFirst({
        where: (c, { eq }) => eq(c.id, input.cardId),
      });
      return updated!;
    }),

  undoApproval: magicLinkProcedure
    .input(z.object({ cardId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.project.status === "SIGNED") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Approvals cannot be undone after final project sign-off.",
        });
      }

      const card = await ctx.db.query.scopeCard.findFirst({
        where: (c, { and, eq }) => and(eq(c.id, input.cardId), eq(c.projectId, ctx.project.id)),
      });

      if (!card || card.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Card is not approved or not found.",
        });
      }

      const now = new Date().toISOString();

      await ctx.db
        .update(scopeCard)
        .set({ status: "PENDING", updatedAt: now })
        .where(eq(scopeCard.id, input.cardId));

      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
        projectId: ctx.project.id,
        action: "CARD_APPROVAL_UNDONE",
        details: JSON.stringify({
          cardId: card.id,
          cardTitle: card.title,
          clientName: ctx.project.clientName,
        }),
        createdAt: now,
      });

      const updated = await ctx.db.query.scopeCard.findFirst({
        where: (c, { eq }) => eq(c.id, input.cardId),
      });
      return updated!;
    }),

  signOff: magicLinkProcedure
    .input(
      z.object({
        typedName: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if all in-scope cards are approved
      const unapprovedCards = await ctx.db.query.scopeCard.findMany({
        where: (c, { and, eq, ne }) =>
          and(eq(c.projectId, ctx.project.id), eq(c.type, "IN_SCOPE"), ne(c.status, "APPROVED")),
      });

      if (unapprovedCards.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Please approve all ${unapprovedCards.length} pending features before signing off.`,
        });
      }

      // Check typed name matches exactly (case-insensitive)
      if (input.typedName.toLowerCase().trim() !== ctx.project.clientName.toLowerCase().trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please type your name exactly as shown to complete the signature.",
        });
      }

      // Capture snapshot of all cards
      const allCards = await ctx.db.query.scopeCard.findMany({
        where: (c, { eq }) => eq(c.projectId, ctx.project.id),
      });

      const signOffRecord = {
        signedByName: input.typedName,
        signedByEmail: ctx.project.clientEmail,
        timestamp: new Date().toISOString(),
        clientIp: ctx.clientIp,
        cardsSnapshot: allCards.map((c) => {
          let parsedIncluded: string[] = [];
          try {
            parsedIncluded = JSON.parse(c.included);
          } catch (_) {
            parsedIncluded = [];
          }
          let parsedExcluded: string[] = [];
          try {
            parsedExcluded = c.excluded ? JSON.parse(c.excluded) : [];
          } catch (_) {
            parsedExcluded = [];
          }
          return {
            title: c.title,
            description: c.description,
            effort: c.effort,
            included: parsedIncluded,
            excluded: parsedExcluded,
            type: c.type,
          };
        }),
      };

      const now = new Date().toISOString();

      await ctx.db
        .update(project)
        .set({
          status: "SIGNED",
          signedAt: now,
          signOffRecord: JSON.stringify(signOffRecord),
          updatedAt: now,
        })
        .where(eq(project.id, ctx.project.id));

      // Create notification
      await ctx.db.insert(notification).values({
        id: randomUUID(),
        agencyId: ctx.project.agencyId,
        projectId: ctx.project.id,
        content: `🎉 Project "${ctx.project.name}" has been formally signed off by ${input.typedName}!`,
        isRead: false,
        createdAt: now,
      });

      // Log activity
      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
        projectId: ctx.project.id,
        action: "PROJECT_SIGNED_OFF",
        details: JSON.stringify({
          signedBy: input.typedName,
          clientIp: ctx.clientIp,
        }),
        createdAt: now,
      });

      const updated = await ctx.db.query.project.findFirst({
        where: (p, { eq }) => eq(p.id, ctx.project.id),
      });
      return updated!;
    }),

  submitChangeRequest: magicLinkProcedure
    .input(
      z.object({
        clientRequest: z.string().min(1).max(3000),
        scopeCardId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const now = new Date().toISOString();
      const requestId = randomUUID();

      await ctx.db.insert(changeRequest).values({
        id: requestId,
        projectId: ctx.project.id,
        scopeCardId: input.scopeCardId || null,
        status: "NEW",
        clientRequest: input.clientRequest,
        createdAt: now,
        updatedAt: now,
      });

      // Update the underlying Scope Card context status immediately
      if (input.scopeCardId) {
        await ctx.db.update(scopeCard)
          .set({ status: "CHANGE_REQUESTED", updatedAt: now })
          .where(eq(scopeCard.id, input.scopeCardId));
      }

      // Notify agency
      await ctx.db.insert(notification).values({
        id: randomUUID(),
        agencyId: ctx.project.agencyId,
        projectId: ctx.project.id,
        content: `${ctx.project.clientName} submitted a change request for "${ctx.project.name}".`,
        isRead: false,
        createdAt: now,
      });

      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
        projectId: ctx.project.id,
        action: "CHANGE_REQUEST_SUBMITTED",
        details: JSON.stringify({
          clientName: ctx.project.clientName,
        }),
        createdAt: now,
      });

      return { success: true, requestId };
    }),

  decideChangeRequest: magicLinkProcedure
    .input(
      z.object({
        requestId: z.string(),
        decision: z.enum(["APPROVED", "DECLINED"]),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const request = await ctx.db.query.changeRequest.findFirst({
        where: (cr, { and, eq }) => and(eq(cr.id, input.requestId), eq(cr.projectId, ctx.project.id)),
      });

      if (!request || request.status !== "PRICED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Change request not found or not ready for decision.",
        });
      }

      const now = new Date().toISOString();
      const newStatus = input.decision; // Direct alignment with canonical flow ("APPROVED" | "DECLINED")

      await ctx.db
        .update(changeRequest)
        .set({
          status: newStatus,
          clientFeedback: input.feedback || null,
          updatedAt: now,
        })
        .where(eq(changeRequest.id, input.requestId));

      // Restore parent card state out of CHANGE_REQUESTED (typically baseline approved)
      if (request.scopeCardId) {
        await ctx.db.update(scopeCard)
          .set({ status: "APPROVED", updatedAt: now })
          .where(eq(scopeCard.id, request.scopeCardId));
      }

      await ctx.db.insert(notification).values({
        id: randomUUID(),
        agencyId: ctx.project.agencyId,
        projectId: ctx.project.id,
        content: `${ctx.project.clientName} ${input.decision.toLowerCase()} change request pricing.`,
        isRead: false,
        createdAt: now,
      });

      await ctx.db.insert(activityLog).values({
        id: randomUUID(),
        projectId: ctx.project.id,
        action: `CHANGE_REQUEST_${input.decision}`,
        details: JSON.stringify({
          clientName: ctx.project.clientName,
        }),
        createdAt: now,
      });

      return { success: true };
    }),
});
