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
});
