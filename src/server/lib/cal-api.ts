import { type CheckInFrequency } from "@prisma/client";
import * as R from "remeda";
import axios from "axios";
import { addDays } from "date-fns";
import { z } from "zod";
import { inngest } from "./inngest/client";
import { getRandomNumberBetween } from "~/lib/utils";

const EventInfoResponseSchema = z.array(
  z.object({
    result: z.object({
      data: z.object({
        json: z.object({
          id: z.number(),
          owner: z.object({
            id: z.number(),
            avatarUrl: z.string().nullish(),
            name: z.string(),
          }),
        }),
      }),
    }),
  }),
);

// Didn't find a way to get the ID of an event type via the official API
export async function getEventTypeInfo({
  username,
  eventSlug,
}: {
  username: string;
  eventSlug: string;
}) {
  const url = `https://cal.com/api/trpc/public/event?batch=1&input={"0"%3A{"json"%3A{"username"%3A"${username}"%2C"eventSlug"%3A"${eventSlug}"%2C"isTeamEvent"%3Afalse%2C"org"%3Anull}}}`;
  const response = await axios.get(url);
  const parsed = EventInfoResponseSchema.parse(response.data);
  return parsed;
}

const calApi = axios.create({
  baseURL: "https://api.cal.com/v1",
});

const GetSlotsResponseSchema = z.object({
  slots: z.record(z.string(), z.array(z.object({ time: z.string() }))),
});
export async function getSlots({
  apiKey,
  startTime,
  endTime,
  eventTypeId,
}: {
  apiKey: string;
  startTime: string;
  endTime: string;
  eventTypeId: number;
}) {
  const response = await calApi.get("/slots", {
    params: {
      apiKey,
      startTime,
      endTime,
      eventTypeId,
    },
  });
  const parsedResponse = GetSlotsResponseSchema.parse(response.data);
  return parsedResponse;
}

const BookingResponseSchema = z.object({
  id: z.number(),
  uid: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});
export async function makeBooking({
  apiKey,
  start,
  eventTypeId,
  userName,
  userEmail,
}: {
  apiKey: string;
  start: string;
  eventTypeId: number;
  userName: string;
  userEmail: string;
}) {
  const response = await calApi.post(
    "/bookings",
    {
      eventTypeId,
      start,
      metadata: {
        checkin: "true",
      },
      // I think the timezone doesn't matter here since we just look up slots and pass that time in
      timeZone: "Europe/Berlin",
      language: "en",
      responses: {
        name: userName,
        email: userEmail,
        location: "",
        notes: "Scheduled with Autocheckin.app",
      },
    },
    { params: { apiKey } },
  );
  const parsedResponse = BookingResponseSchema.parse(response.data);
  return parsedResponse;
}

export async function scheduleNextBooking({
  frequency,
  apiKey,
  eventTypeId,
  userEmail,
  userName,
  contactId,
}: {
  frequency: CheckInFrequency;
  apiKey: string;
  eventTypeId: number;
  contactId: string;
  userName: string;
  userEmail: string;
}) {
  const now = new Date();
  let start;
  let end;

  if (frequency === "WEEKLY") {
    start = addDays(now, 6).toISOString();
    end = addDays(now, 10).toISOString();
  }

  if (frequency === "BIWEEKLY") {
    start = addDays(now, 12).toISOString();
    end = addDays(now, 18).toISOString();
  }

  if (frequency === "MONTHLY") {
    start = addDays(now, 28).toISOString();
    end = addDays(now, 34).toISOString();
  }

  if (frequency === "QUARTERLY") {
    start = addDays(now, 80).toISOString();
    end = addDays(now, 100).toISOString();
  }

  if (frequency === "BIYEARLY") {
    start = addDays(now, 160).toISOString();
    end = addDays(now, 200).toISOString();
  }

  if (frequency === "YEARLY") {
    start = addDays(now, 340).toISOString();
    end = addDays(now, 390).toISOString();
  }

  if (!start || !end) {
    throw new Error("Failed to get start/end");
  }

  // get slots between first and last date
  // shuffle keys of reponse
  const { slots } = await getSlots({
    apiKey,
    eventTypeId,
    startTime: start,
    endTime: end,
  });

  const keys = Object.keys(slots);
  if (keys.length === 0) {
    // could add retries here if no event is found for that time range, increase endTime until something is found
    // for now we just schedule another meeting function
    const randomAmountDays = getRandomNumberBetween(1, 3);
    await inngest.send({
      name: "schedule-meeting",
      data: {
        contactId,
        runTime: addDays(end, randomAmountDays).toISOString(),
      },
    });
    return;
  }

  const [randomKey] = R.shuffle(keys);
  if (!randomKey) {
    return;
  }
  const timeSlots = slots[randomKey]!;
  const [randomSlot] = R.shuffle(timeSlots);

  if (!randomSlot) {
    return;
  }

  const booking = await makeBooking({
    apiKey,
    userName,
    userEmail,
    eventTypeId,
    start: randomSlot.time,
  });

  // schedule when to make next booking
  const randomAmountDays = getRandomNumberBetween(1, 3);
  await inngest.send({
    name: "schedule-meeting",
    data: {
      contactId,
      runTime: addDays(booking.endTime, randomAmountDays).toISOString(),
    },
  });

  return booking;
}

export async function cancelBooking({ uid }: { uid: string }) {
  await axios.post("https://app.cal.com/api/cancel", {
    allRemainingBookings: false,
    cancellationReason: "",
    uid,
  });
  return;
}
