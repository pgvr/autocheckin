import { captureMessage } from "@sentry/nextjs";
import { addDays } from "date-fns";
import { NonRetriableError } from "inngest";

import { getRandomNumberBetween } from "~/lib/utils";
import { db } from "~/server/db";

import { scheduleNextBooking } from "../cal-api";
import { CalConnectionError } from "../cal-oauth";
import { inngest } from "./client";

export const reseedUserSchedulesFunction = inngest.createFunction(
  {
    id: "reseed-user-schedules",
  },
  { event: "reseed-user-schedules" },
  async ({ event, step }) => {
    const user = await step.run("load-user-contacts", async () => {
      return db.user.findUnique({
        where: {
          id: event.data.userId,
        },
        include: {
          contacts: {
            include: {
              bookings: {
                where: {
                  startTime: {
                    gte: new Date(),
                  },
                },
                orderBy: {
                  endTime: "desc",
                },
              },
            },
          },
        },
      });
    });

    if (!user) {
      throw new NonRetriableError("User not found");
    }

    for (const contact of user.contacts) {
      const stepIdPrefix = contact.id.slice(0, 8);

      await step.run(`cancel-queued-${stepIdPrefix}`, async () => {
        await inngest.send({
          name: "cancel-schedule-meeting",
          data: {
            contactId: contact.id,
          },
        });
      });

      const latestFutureBooking = contact.bookings[0];
      if (latestFutureBooking) {
        await step.run(`requeue-${stepIdPrefix}`, async () => {
          await inngest.send({
            name: "schedule-meeting",
            data: {
              contactId: contact.id,
              runTime: addDays(
                new Date(latestFutureBooking.endTime),
                getRandomNumberBetween(1, 3),
              ).toISOString(),
            },
          });
        });
        continue;
      }

      let booking;
      try {
        booking = await step.run(`schedule-now-${stepIdPrefix}`, async () => {
          return scheduleNextBooking({
            contactId: contact.id,
            frequency: contact.checkInFrequency,
            userId: user.id,
            eventTypeId: contact.eventTypeId,
            userEmail: user.email ?? "",
            userName: user.name ?? user.email ?? "",
          });
        });
      } catch (error) {
        if (error instanceof CalConnectionError) {
          captureMessage(
            "Stopping schedule reseed because Cal connection is missing",
            {
              extra: {
                userId: user.id,
                contactId: contact.id,
              },
            },
          );
          throw new NonRetriableError(error.message);
        }

        throw error;
      }

      if (!booking) {
        continue;
      }

      await step.run(`persist-booking-${stepIdPrefix}`, async () => {
        await db.booking.create({
          data: {
            userId: user.id,
            contactId: contact.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            calId: booking.id,
            calUid: booking.uid,
          },
        });
      });
    }

    return {};
  },
);
