import { type CheckInFrequency } from "@prisma/client";
import axios from "axios";
import { addDays, addMinutes } from "date-fns";
import * as R from "remeda";
import { z } from "zod";
import { getRandomNumberBetween } from "~/lib/utils";
import { inngest } from "./inngest/client";
import { captureMessage } from "@sentry/nextjs";

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
          length: z.number(),
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
const GetEventTypeResponseSchema = z.object({
  event_type: z.object({
    id: z.number(),
    title: z.string(),
    slug: z.string(),
    length: z.number(),
  }),
});
export async function getEventType({
  apiKey,
  eventTypeId,
}: {
  apiKey: string;
  eventTypeId: number;
}) {
  try {
    const response = await calApi.get(`/event-types/${eventTypeId}`, {
      params: {
        apiKey,
      },
    });
    console.log("resp", response);
    const parsedResponse = GetEventTypeResponseSchema.parse(response.data);
    return parsedResponse;
  } catch (error) {
    console.log(error);
    throw error;
  }
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

const AvailabilityResponseSchema = z.object({
  dateRanges: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
    }),
  ),
  timeZone: z.string(),
});
export async function getAvailability({
  apiKey,
  username,
  dateFrom,
  dateTo,
}: {
  apiKey: string;
  username: string;
  dateFrom: string;
  dateTo: string;
}) {
  const response = await calApi.get("/availability", {
    params: { apiKey, dateFrom, dateTo, username },
  });
  const parsedResponse = AvailabilityResponseSchema.parse(response.data);
  return parsedResponse;
}
const MeResponseSchema = z.object({
  user: z.object({
    id: z.number(),
    username: z.string(),
  }),
});
export async function getUserInfo({ apiKey }: { apiKey: string }) {
  const response = await calApi.get("/me", {
    params: { apiKey },
  });
  const parsedResponse = MeResponseSchema.parse(response.data);
  return parsedResponse;
}

export async function scheduleNextBooking({
  frequency,
  apiKey,
  eventTypeId,
  userEmail,
  userName,
  contactId,
  contactCalLink,
}: {
  frequency: CheckInFrequency;
  apiKey: string;
  eventTypeId: number;
  contactId: string;
  contactCalLink: string;
  userName: string;
  userEmail: string;
}) {
  const { user } = await getUserInfo({ apiKey });
  const splits = contactCalLink.split("/");
  const eventSlug = splits[splits.length - 1];
  const username = splits[splits.length - 2];
  if (!eventSlug || !username) {
    throw new Error("Slug or username not defined");
  }

  const [eventInfo] = await getEventTypeInfo({ username, eventSlug });
  if (!eventInfo) {
    throw new Error("Event info not found");
  }
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

  // first, get availability of the user
  const availability = await getAvailability({
    apiKey,
    username: user.username,
    dateFrom: start,
    dateTo: end,
  });

  const shuffledAvailabilities = R.shuffle(availability.dateRanges);

  const { slots } = await getSlots({
    apiKey,
    eventTypeId,
    startTime: start,
    endTime: end,
  });

  const slotKeys = Object.keys(slots);

  const slotValues = Object.values(slots).flat();
  let slotToBook;
  for (const a of shuffledAvailabilities) {
    const matchingSlot = slotValues.find((s) => {
      const startOfSlot = new Date(s.time);
      const endOfSlot = addMinutes(
        startOfSlot,
        eventInfo.result.data.json.length,
      );
      const isWithinAvailability =
        new Date(a.start) <= startOfSlot && new Date(a.end) >= endOfSlot;
      return isWithinAvailability;
    });
    if (matchingSlot) {
      slotToBook = matchingSlot;
      console.log("found matching slot", matchingSlot, a);
      break;
    }
  }

  if (slotKeys.length === 0 || !slotToBook) {
    // either there are no slots available at all or none within availablities
    // just "skip" this one and schedule next one
    // could add retries here to make it more robust or already schedule the next meeting right now
    const randomAmountDays = getRandomNumberBetween(1, 3);
    await inngest.send({
      name: "schedule-meeting",
      data: {
        contactId,
        runTime: addDays(end, randomAmountDays).toISOString(),
      },
    });
    captureMessage("Failed to find a time", {
      extra: {
        contactId,
        start,
        end,
      },
    });
    return;
  }

  const booking = await makeBooking({
    apiKey,
    userName,
    userEmail,
    eventTypeId,
    start: slotToBook.time,
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
