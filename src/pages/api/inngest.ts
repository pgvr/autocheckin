import { serve } from "inngest/next";
import { inngest } from "~/server/lib/inngest/client";
import { reseedUserSchedulesFunction } from "~/server/lib/inngest/reseed-user-schedules";
import { scheduleMeetingFunction } from "~/server/lib/inngest/schedule-meeting";

export default serve({
  client: inngest,
  functions: [scheduleMeetingFunction, reseedUserSchedulesFunction],
});
