import { type NextApiRequest, type NextApiResponse } from "next";

import {
  buildAuthorizeUrl,
  createCalOAuthState,
  createCalOAuthStateCookie,
} from "~/server/lib/cal-oauth";
import { getServerAuthSession } from "~/server/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const session = await getServerAuthSession({ req, res });
  if (!session?.user?.id) {
    res.redirect(302, "/login");
    return;
  }

  const state = createCalOAuthState();

  res.setHeader("Set-Cookie", createCalOAuthStateCookie(state));
  res.redirect(302, buildAuthorizeUrl(state));
}
