import { captureException } from "@sentry/nextjs";
import { CheckInFrequency } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  cancelBooking,
  getEventTypeInfo,
  scheduleNextBooking,
} from "~/server/lib/cal-api";
import { CalConnectionError } from "~/server/lib/cal-oauth";
import { inngest } from "~/server/lib/inngest/client";

const logContactCreate = (
  message: string,
  extra: Record<string, unknown>,
  level: "info" | "error" = "info",
) => {
  const payload = {
    message,
    ...extra,
  };

  if (level === "error") {
    console.error("[contact.create]", payload);
    return;
  }

  console.info("[contact.create]", payload);
};

const throwIfCalConnectionError = (error: unknown): never => {
  if (error instanceof CalConnectionError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }

  throw error;
};

export const contactRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const contacts = await ctx.db.contact.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      include: {
        bookings: true,
      },
    });

    return contacts;
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const contact = await ctx.db.contact.findFirstOrThrow({
        where: {
          userId: ctx.session.user.id,
          id: input.id,
        },
      });

      return contact;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        calLink: z.string().refine(
          (val) => {
            if (!val) {
              return false;
            }

            const splits = val.split("cal.com");
            const urlPart = splits[1];
            if (!urlPart) {
              return false;
            }

            const slashSplits = urlPart.split("/");
            const [, username, type] = slashSplits;
            if (!username || !type) {
              return false;
            }

            return true;
          },
          { message: "The Cal.com link needs to include an event type" },
        ),
        checkInFrequency: z.nativeEnum(CheckInFrequency),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      logContactCreate("starting", {
        userId: ctx.session.user.id,
        checkInFrequency: input.checkInFrequency,
        calLink: input.calLink,
      });

      const splits = input.calLink.split("cal.com");
      const urlPart = splits[1];
      if (!urlPart) {
        return false;
      }

      const slashSplits = urlPart.split("/");
      const [, username, type] = slashSplits;
      if (!username || !type) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Malformed cal.com link. Event type needs to be included in URL.",
        });
      }

      const [typeWithoutParams] = type.split("?");
      if (!typeWithoutParams) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No event type found in URL.",
        });
      }

      logContactCreate("parsed-cal-link", {
        userId: ctx.session.user.id,
        calUsername: username,
        eventSlug: typeWithoutParams,
      });

      const formattedLink = input.calLink.split("?")[0];
      if (!formattedLink) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to format link",
        });
      }

      let info;
      try {
        logContactCreate("fetching-event-type-info", {
          userId: ctx.session.user.id,
          calUsername: username,
          eventSlug: typeWithoutParams,
        });

        info = await getEventTypeInfo({
          userId: ctx.session.user.id,
          username,
          eventSlug: typeWithoutParams,
        });
      } catch (error) {
        logContactCreate(
          "event-type-info-fetch-failed",
          {
            userId: ctx.session.user.id,
            calUsername: username,
            eventSlug: typeWithoutParams,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
          "error",
        );

        captureException(error, {
          extra: {
            stage: "getEventTypeInfo",
            userId: ctx.session.user.id,
            calUsername: username,
            eventSlug: typeWithoutParams,
          },
        });

        throwIfCalConnectionError(error);
      }

      if (!info) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve info from cal.com API",
        });
      }

      logContactCreate("event-type-info-resolved", {
        userId: ctx.session.user.id,
        calUsername: username,
        eventSlug: typeWithoutParams,
        eventTypeId: info.id,
        ownerId: info.ownerId,
        bookingRequiresAuthentication: info.bookingRequiresAuthentication,
      });

      if (info.bookingRequiresAuthentication) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This Cal.com event requires attendee authentication and cannot be used for automatic check-ins.",
        });
      }

      const contact = await ctx.db.contact.create({
        data: {
          name: input.name,
          calLink: formattedLink,
          userId: ctx.session.user.id,
          checkInFrequency: input.checkInFrequency,
          eventTypeId: info.id,
          calId: info.ownerId,
          calName: info.owner.name,
          calAvatarUrl: info.owner.avatarUrl,
        },
        select: {
          id: true,
        },
      });

      logContactCreate("contact-persisted", {
        userId: ctx.session.user.id,
        contactId: contact.id,
        eventTypeId: info.id,
      });

      let firstBooking:
        | Awaited<ReturnType<typeof scheduleNextBooking>>
        | undefined = undefined;

      try {
        logContactCreate("scheduling-first-booking", {
          userId: ctx.session.user.id,
          contactId: contact.id,
          eventTypeId: info.id,
          checkInFrequency: input.checkInFrequency,
        });

        firstBooking = await scheduleNextBooking({
          userId: ctx.session.user.id,
          userName: ctx.session.user.name ?? ctx.session.user.email ?? "",
          userEmail: ctx.session.user.email ?? "",
          eventTypeId: info.id,
          calLink: formattedLink,
          frequency: input.checkInFrequency,
          contactId: contact.id,
        });

        if (firstBooking) {
          logContactCreate("first-booking-created-remotely", {
            userId: ctx.session.user.id,
            contactId: contact.id,
            calBookingId: firstBooking.id,
            calBookingUid: firstBooking.uid,
            startTime: firstBooking.startTime,
            endTime: firstBooking.endTime,
          });

          await ctx.db.booking.create({
            data: {
              userId: ctx.session.user.id,
              calId: firstBooking.id,
              calUid: firstBooking.uid,
              startTime: firstBooking.startTime,
              endTime: firstBooking.endTime,
              contactId: contact.id,
            },
          });

          logContactCreate("first-booking-persisted", {
            userId: ctx.session.user.id,
            contactId: contact.id,
            calBookingId: firstBooking.id,
            calBookingUid: firstBooking.uid,
          });
        } else {
          logContactCreate("no-initial-booking-created", {
            userId: ctx.session.user.id,
            contactId: contact.id,
            eventTypeId: info.id,
          });
        }
      } catch (error) {
        logContactCreate(
          "initial-booking-failed",
          {
            userId: ctx.session.user.id,
            contactId: contact.id,
            eventTypeId: info.id,
            calBookingUid: firstBooking?.uid,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
          "error",
        );

        captureException(error, {
          extra: {
            stage: "scheduleNextBooking",
            userId: ctx.session.user.id,
            contactId: contact.id,
            eventTypeId: info.id,
            calBookingUid: firstBooking?.uid,
            checkInFrequency: input.checkInFrequency,
          },
        });

        await inngest.send({
          name: "cancel-schedule-meeting",
          data: {
            contactId: contact.id,
          },
        });

        logContactCreate("sent-cancel-schedule-event", {
          userId: ctx.session.user.id,
          contactId: contact.id,
        });

        if (firstBooking) {
          try {
            await cancelBooking({
              userId: ctx.session.user.id,
              uid: firstBooking.uid,
            });

            logContactCreate("cancelled-remote-booking", {
              userId: ctx.session.user.id,
              contactId: contact.id,
              calBookingUid: firstBooking.uid,
            });
          } catch {
            // Best-effort cleanup for partially created remote bookings.
            logContactCreate(
              "failed-to-cancel-remote-booking-during-cleanup",
              {
                userId: ctx.session.user.id,
                contactId: contact.id,
                calBookingUid: firstBooking.uid,
              },
              "error",
            );
          }
        }

        await ctx.db.contact.delete({
          where: {
            id: contact.id,
          },
        });

        logContactCreate("deleted-contact-during-cleanup", {
          userId: ctx.session.user.id,
          contactId: contact.id,
        });

        throwIfCalConnectionError(error);
      }

      logContactCreate("completed", {
        userId: ctx.session.user.id,
        contactId: contact.id,
        eventTypeId: info.id,
        createdBooking: Boolean(firstBooking),
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        checkInFrequency: z.nativeEnum(CheckInFrequency),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const upcomingBookings = await ctx.db.booking.findMany({
        where: {
          userId,
          contactId: input.id,
          startTime: {
            gte: new Date(),
          },
        },
      });

      const contact = await ctx.db.contact.update({
        where: {
          userId,
          id: input.id,
        },
        data: {
          name: input.name,
          checkInFrequency: input.checkInFrequency,
        },
        select: {
          id: true,
          eventTypeId: true,
          calLink: true,
          checkInFrequency: true,
        },
      });

      await inngest.send({
        name: "cancel-schedule-meeting",
        data: {
          contactId: contact.id,
        },
      });

      for (const booking of upcomingBookings) {
        try {
          await cancelBooking({
            userId,
            uid: booking.calUid,
          });
        } catch (error) {
          throwIfCalConnectionError(error);
        }

        await ctx.db.booking.delete({
          where: {
            id: booking.id,
          },
        });
      }

      let nextBooking:
        | Awaited<ReturnType<typeof scheduleNextBooking>>
        | undefined = undefined;

      try {
        nextBooking = await scheduleNextBooking({
          contactId: contact.id,
          userId,
          userName: ctx.session.user.name ?? ctx.session.user.email ?? "",
          userEmail: ctx.session.user.email ?? "",
          eventTypeId: contact.eventTypeId,
          calLink: contact.calLink,
          frequency: contact.checkInFrequency,
        });

        if (nextBooking) {
          await ctx.db.booking.create({
            data: {
              userId,
              calId: nextBooking.id,
              calUid: nextBooking.uid,
              startTime: nextBooking.startTime,
              endTime: nextBooking.endTime,
              contactId: contact.id,
            },
          });
        }
      } catch (error) {
        await inngest.send({
          name: "cancel-schedule-meeting",
          data: {
            contactId: contact.id,
          },
        });

        if (nextBooking) {
          try {
            await cancelBooking({
              userId,
              uid: nextBooking.uid,
            });
          } catch {
            // Best-effort cleanup for partially created remote bookings.
          }
        }

        throwIfCalConnectionError(error);
      }
    }),

  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const upcomingBookings = await ctx.db.booking.findMany({
        where: {
          userId,
          contactId: input.id,
          startTime: {
            gte: new Date(),
          },
        },
      });

      await inngest.send({
        name: "cancel-schedule-meeting",
        data: {
          contactId: input.id,
        },
      });

      for (const booking of upcomingBookings) {
        try {
          await cancelBooking({
            userId,
            uid: booking.calUid,
          });
        } catch (error) {
          throwIfCalConnectionError(error);
        }
      }

      await ctx.db.contact.delete({
        where: {
          userId,
          id: input.id,
        },
      });
    }),
});
