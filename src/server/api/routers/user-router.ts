import { deleteCalConnection } from "~/server/lib/cal-oauth";
import { inngest } from "~/server/lib/inngest/client";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  info: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findFirst({
      where: {
        id: ctx.session.user.id,
      },
      include: {
        calConnection: true,
      },
    });
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      hasCalConnection: !!user.calConnection,
      calProfile: user.calConnection
        ? {
            username: user.calConnection.calUsername,
            name: user.calConnection.calName,
            avatarUrl: user.calConnection.calAvatarUrl,
          }
        : undefined,
    };
  }),

  disconnectCal: protectedProcedure.mutation(async ({ ctx }) => {
    const contacts = await ctx.db.contact.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      select: {
        id: true,
      },
    });

    await Promise.all(
      contacts.map(async (contact) => {
        await inngest.send({
          name: "cancel-schedule-meeting",
          data: {
            contactId: contact.id,
          },
        });
      }),
    );

    await deleteCalConnection(ctx.session.user.id);

    return {
      success: true,
    };
  }),
});
