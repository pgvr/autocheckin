import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { db } from "~/server/db";
import { scheduleNextBooking } from "../cal-api";

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
      if (!contact.user.calApiKey) {
        throw new NonRetriableError("User has no API key");
      }

      const booking = await scheduleNextBooking({
        contactId: contact.id,
        frequency: contact.checkInFrequency,
        apiKey: contact.user.calApiKey,
        eventTypeId: contact.eventTypeId,
        userEmail: contact.user.email ?? "",
        userName: contact.user.name ?? contact.user.email ?? "",
      });

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
        if (!contact.user.calApiKey) {
          throw new NonRetriableError("User has no API key");
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
