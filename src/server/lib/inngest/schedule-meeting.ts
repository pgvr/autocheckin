import { captureMessage } from "@sentry/nextjs";
import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { db } from "~/server/db";
import { scheduleNextBooking } from "../cal-api";
import { CalConnectionError } from "../cal-oauth";

export const scheduleMeetingFunction = inngest.createFunction(
  {
    id: "schedule-meeting",
    // When we send a new event, e.g. when the frequency was updated, we cancel any prev. runs
    cancelOn: [{ event: "cancel-schedule-meeting", match: "data.contactId" }],
  },
  { event: "schedule-meeting" },
  async ({ event, step }) => {
    await step.sleepUntil("wait-until-after-checkin", event.data.runTime);

    const booking = await step.run("schedule-next-checkin", async () => {
      const contact = await db.contact.findFirst({
        where: {
          id: event.data.contactId,
        },
        include: {
          user: true,
        },
      });
      if (!contact) {
        throw new NonRetriableError("Contact not found");
      }

      let booking;
      try {
        booking = await scheduleNextBooking({
          contactId: contact.id,
          frequency: contact.checkInFrequency,
          userId: contact.user.id,
          eventTypeId: contact.eventTypeId,
          calLink: contact.calLink,
          userEmail: contact.user.email ?? "",
          userName: contact.user.name ?? contact.user.email ?? "",
        });
      } catch (error) {
        if (error instanceof CalConnectionError) {
          captureMessage(
            "Stopping scheduled check-in because Cal connection is missing",
            {
              extra: {
                contactId: contact.id,
                userId: contact.user.id,
              },
            },
          );
          throw new NonRetriableError(error.message);
        }

        throw error;
      }

      return booking;
    });

    if (booking) {
      await step.run("save-booking-to-db", async () => {
        const contact = await db.contact.findFirst({
          where: {
            id: event.data.contactId,
          },
          include: {
            user: true,
          },
        });
        if (!contact) {
          throw new NonRetriableError("Contact not found");
        }
        await db.booking.create({
          data: {
            userId: contact.user.id,
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
