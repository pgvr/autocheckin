import { CheckInFrequency } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  cancelBooking,
  getEventTypeInfo,
  scheduleNextBooking,
} from "~/server/lib/cal-api";
import { inngest } from "~/server/lib/inngest/client";

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
            // https://cal.com/patrick-productlane/30min?date=2024-04-22&month=2024-04
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
      const apiKey = ctx.session.user.calApiKey;
      if (!apiKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cal.com API key required",
        });
      }
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

      const formattedLink = input.calLink.split("?")[0];
      if (!formattedLink) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to format link",
        });
      }

      // look up event type
      const [info] = await getEventTypeInfo({
        username,
        eventSlug: typeWithoutParams,
      });
      if (!info) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve info from cal.com API",
        });
      }

      await ctx.db.$transaction(
        async (tx) => {
          const contact = await tx.contact.create({
            data: {
              name: input.name,
              calLink: formattedLink,
              userId: ctx.session.user.id,
              checkInFrequency: input.checkInFrequency,
              eventTypeId: info.result.data.json.id,
              calId: info.result.data.json.owner.id,
              calName: info.result.data.json.owner.name,
              calAvatarUrl: info.result.data.json.owner.avatarUrl,
            },

            select: {
              id: true,
            },
          });
          const firstBooking = await scheduleNextBooking({
            userName: ctx.session.user.name ?? ctx.session.user.email ?? "",
            userEmail: ctx.session.user.email ?? "",
            eventTypeId: info.result.data.json.id,
            apiKey,
            frequency: input.checkInFrequency,
            contactId: contact.id,
            contactCalLink: formattedLink,
          });
          if (firstBooking) {
            await tx.booking.create({
              data: {
                userId: ctx.session.user.id,
                calId: firstBooking.id,
                calUid: firstBooking.uid,
                startTime: firstBooking.startTime,
                endTime: firstBooking.endTime,
                contactId: contact.id,
              },
            });
          }
        },
        { timeout: 10_000 },
      );
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
      const apiKey = ctx.session.user.calApiKey;
      if (!apiKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cal.com API key required",
        });
      }

      await ctx.db.$transaction(
        async (tx) => {
          const contact = await tx.contact.update({
            where: {
              userId: ctx.session.user.id,
              id: input.id,
            },
            data: {
              name: input.name,
              checkInFrequency: input.checkInFrequency,
            },
            select: {
              id: true,
              eventTypeId: true,
              checkInFrequency: true,
              calLink: true,
            },
          });

          await inngest.send({
            name: "cancel-schedule-meeting",
            data: {
              contactId: contact.id,
            },
          });
          const upcomingBookings = await tx.booking.findMany({
            where: {
              userId: ctx.session.user.id,
              contactId: contact.id,
              startTime: {
                gte: new Date(),
              },
            },
          });
          for (const booking of upcomingBookings) {
            await cancelBooking({ uid: booking.calUid });
            await tx.booking.delete({
              where: {
                id: booking.id,
              },
            });
          }

          const nextBooking = await scheduleNextBooking({
            contactId: contact.id,
            userName: ctx.session.user.name ?? ctx.session.user.email ?? "",
            userEmail: ctx.session.user.email ?? "",
            eventTypeId: contact.eventTypeId,
            apiKey,
            frequency: contact.checkInFrequency,
            contactCalLink: contact.calLink,
          });
          if (nextBooking) {
            await tx.booking.create({
              data: {
                userId: ctx.session.user.id,
                calId: nextBooking.id,
                calUid: nextBooking.uid,
                startTime: nextBooking.startTime,
                endTime: nextBooking.endTime,
                contactId: contact.id,
              },
            });
          }
        },
        { timeout: 10_000 },
      );
    }),
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const upcomingBookings = await ctx.db.booking.findMany({
        where: {
          userId: ctx.session.user.id,
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
        await cancelBooking({ uid: booking.calUid });
      }
      await ctx.db.contact.delete({
        where: {
          userId: ctx.session.user.id,
          id: input.id,
        },
        select: {
          id: true,
        },
      });
    }),
});
