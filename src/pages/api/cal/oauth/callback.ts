import { captureException } from "@sentry/nextjs";
import { type NextApiRequest, type NextApiResponse } from "next";

import {
  CAL_OAUTH_STATE_COOKIE_NAME,
  clearCalOAuthStateCookie,
  exchangeCodeForTokens,
  getCalProfile,
  saveCalConnection,
} from "~/server/lib/cal-oauth";
import { inngest } from "~/server/lib/inngest/client";
import { getServerAuthSession } from "~/server/auth";

const getSingleQueryValue = (value: string | string[] | undefined) => {
  if (typeof value === "string") {
    return value;
  }

  return undefined;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerAuthSession({ req, res });
  if (!session?.user?.id) {
    res.redirect(302, "/login");
    return;
  }

  const clearStateCookie = clearCalOAuthStateCookie();
  const stateFromCookie = req.cookies[CAL_OAUTH_STATE_COOKIE_NAME];
  const stateFromQuery = getSingleQueryValue(req.query.state);
  const code = getSingleQueryValue(req.query.code);
  const oauthError = getSingleQueryValue(req.query.error);

  const redirectWithError = () => {
    res.setHeader("Set-Cookie", clearStateCookie);
    res.redirect(302, "/home?cal=error");
  };

  if (oauthError) {
    redirectWithError();
    return;
  }

  if (
    !stateFromCookie ||
    !stateFromQuery ||
    stateFromCookie !== stateFromQuery
  ) {
    redirectWithError();
    return;
  }

  if (!code) {
    redirectWithError();
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getCalProfile(tokens.accessToken);

    await saveCalConnection({
      userId: session.user.id,
      profile,
      tokens,
    });

    await inngest.send({
      name: "reseed-user-schedules",
      data: {
        userId: session.user.id,
      },
    });

    res.setHeader("Set-Cookie", clearStateCookie);
    res.redirect(302, "/home?cal=connected");
  } catch (error) {
    captureException(error, {
      extra: {
        userId: session.user.id,
      },
    });

    redirectWithError();
  }
}
