import { EventSchemas, Inngest, type LiteralZodEventSchema } from "inngest";
import { z } from "zod";

const scheduleMeetingEvent = z.object({
  name: z.literal("schedule-meeting"),
  data: z.object({ contactId: z.string(), runTime: z.string() }),
}) satisfies LiteralZodEventSchema;

const cancelScheduleMeetingEvent = z.object({
  name: z.literal("cancel-schedule-meeting"),
  data: z.object({ contactId: z.string() }),
}) satisfies LiteralZodEventSchema;

export const inngest = new Inngest({
  id: "check-in",
  schemas: new EventSchemas().fromZod([
    scheduleMeetingEvent,
    cancelScheduleMeetingEvent,
  ]),
});
