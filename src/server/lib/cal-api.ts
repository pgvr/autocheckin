import { type CheckInFrequency } from "@prisma/client";
import { captureMessage } from "@sentry/nextjs";
import axios, { type Method } from "axios";
import { addDays } from "date-fns";
import * as R from "remeda";
import { z } from "zod";

import { getRandomNumberBetween } from "~/lib/utils";

import { getValidAccessToken } from "./cal-oauth";
import { inngest } from "./inngest/client";

const CAL_API_V2_BASE_URL = "https://api.cal.com/v2";
const EVENT_TYPES_API_VERSION = "2024-06-14";
const SLOTS_API_VERSION = "2024-09-04";
const BOOKINGS_API_VERSION = "2026-02-25";
const DEFAULT_ATTENDEE_TIMEZONE = "Europe/Berlin";
const DEFAULT_ATTENDEE_LANGUAGE = "en";

const calApi = axios.create({
  baseURL: CAL_API_V2_BASE_URL,
});

const successEnvelope = <TSchema extends z.ZodTypeAny>(data: TSchema) =>
  z.object({
    status: z.literal("success"),
    data,
  });

const getHeaders = (accessToken: string, apiVersion?: string) => ({
  Authorization: `Bearer ${accessToken}`,
  ...(apiVersion ? { "cal-api-version": apiVersion } : {}),
});

const EventTypeSchema = z.object({
  id: z.number(),
  lengthInMinutes: z.number(),
  ownerId: z.number().optional(),
  users: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        avatarUrl: z.string().nullish(),
      }),
    )
    .min(1),
});

const EventTypesResponseSchema = successEnvelope(z.array(EventTypeSchema));

const SlotsResponseSchema = successEnvelope(
  z.record(
    z.string(),
    z.array(
      z.object({
        start: z.string(),
      }),
    ),
  ),
);

const BookingSchema = z.object({
  id: z.number(),
  uid: z.string(),
  start: z.string(),
  end: z.string(),
});

const BookingResponseSchema = successEnvelope(BookingSchema);

type CalEventTypeInfo = {
  id: number;
  lengthInMinutes: number;
  ownerId: number;
  owner: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  };
};

type ScheduledBooking = {
  id: number;
  uid: string;
  startTime: string;
  endTime: string;
};

const toScheduledBooking = (booking: z.infer<typeof BookingSchema>) => ({
  id: booking.id,
  uid: booking.uid,
  startTime: booking.start,
  endTime: booking.end,
});

const requestCalApi = async <TOutput>({
  userId,
  method,
  url,
  apiVersion,
  params,
  data,
  schema,
}: {
  userId: string;
  method: Method;
  url: string;
  apiVersion?: string;
  params?: Record<string, unknown>;
  data?: unknown;
  schema: z.ZodType<TOutput>;
}): Promise<TOutput> => {
  const execute = async (accessToken: string) => {
    const response = await calApi.request<unknown>({
      method,
      url,
      params,
      data,
      headers: getHeaders(accessToken, apiVersion),
    });

    return schema.parse(response.data);
  };

  let accessToken = await getValidAccessToken(userId);

  try {
    return await execute(accessToken);
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      throw error;
    }

    accessToken = await getValidAccessToken(userId, { forceRefresh: true });
    return await execute(accessToken);
  }
};

export async function getEventTypeInfo({
  userId,
  username,
  eventSlug,
}: {
  userId: string;
  username: string;
  eventSlug: string;
}): Promise<CalEventTypeInfo | null> {
  const parsedResponse = await requestCalApi({
    userId,
    method: "GET",
    url: "/event-types",
    apiVersion: EVENT_TYPES_API_VERSION,
    params: {
      username,
      eventSlug,
    },
    schema: EventTypesResponseSchema,
  });

  const [eventType] = parsedResponse.data;
  if (!eventType) {
    return null;
  }

  const [owner] = eventType.users;
  if (!owner) {
    return null;
  }

  return {
    id: eventType.id,
    lengthInMinutes: eventType.lengthInMinutes,
    ownerId: eventType.ownerId ?? owner.id,
    owner,
  };
}

export async function getSlots({
  userId,
  start,
  end,
  eventTypeId,
}: {
  userId: string;
  start: string;
  end: string;
  eventTypeId: number;
}): Promise<z.infer<typeof SlotsResponseSchema>["data"]> {
  const parsedResponse = await requestCalApi({
    userId,
    method: "GET",
    url: "/slots",
    apiVersion: SLOTS_API_VERSION,
    params: {
      start,
      end,
      eventTypeId,
    },
    schema: SlotsResponseSchema,
  });

  return parsedResponse.data;
}

export async function makeBooking({
  userId,
  start,
  eventTypeId,
  userName,
  userEmail,
}: {
  userId: string;
  start: string;
  eventTypeId: number;
  userName: string;
  userEmail: string;
}): Promise<ScheduledBooking> {
  const parsedResponse = await requestCalApi({
    userId,
    method: "POST",
    url: "/bookings",
    apiVersion: BOOKINGS_API_VERSION,
    data: {
      eventTypeId,
      start,
      attendee: {
        name: userName,
        email: userEmail,
        timeZone: DEFAULT_ATTENDEE_TIMEZONE,
        language: DEFAULT_ATTENDEE_LANGUAGE,
      },
      metadata: {
        checkin: "true",
      },
    },
    schema: BookingResponseSchema,
  });

  return toScheduledBooking(parsedResponse.data);
}

export async function scheduleNextBooking({
  frequency,
  userId,
  eventTypeId,
  userEmail,
  userName,
  contactId,
}: {
  frequency: CheckInFrequency;
  userId: string;
  eventTypeId: number;
  contactId: string;
  userName: string;
  userEmail: string;
}): Promise<ScheduledBooking | undefined> {
  const now = new Date();
  let start: string | undefined;
  let end: string | undefined;

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

  const slots = await getSlots({
    userId,
    eventTypeId,
    start,
    end,
  });
  const slotValues = R.shuffle(Object.values(slots).flat());
  const slotToBook = slotValues[0];

  if (!slotToBook) {
    const randomAmountDays = getRandomNumberBetween(1, 3);
    await inngest.send({
      name: "schedule-meeting",
      data: {
        contactId,
        runTime: addDays(new Date(end), randomAmountDays).toISOString(),
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
    userId,
    userName,
    userEmail,
    eventTypeId,
    start: slotToBook.start,
  });

  const randomAmountDays = getRandomNumberBetween(1, 3);
  await inngest.send({
    name: "schedule-meeting",
    data: {
      contactId,
      runTime: addDays(
        new Date(booking.endTime),
        randomAmountDays,
      ).toISOString(),
    },
  });

  return booking;
}

export async function cancelBooking({
  userId,
  uid,
}: {
  userId: string;
  uid: string;
}) {
  await requestCalApi({
    userId,
    method: "POST",
    url: `/bookings/${uid}/cancel`,
    apiVersion: BOOKINGS_API_VERSION,
    data: {
      cancellationReason: "",
    },
    schema: z.unknown(),
  });
}
