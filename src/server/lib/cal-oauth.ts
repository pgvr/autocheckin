import crypto from "crypto";
import axios from "axios";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";

const CAL_OAUTH_AUTHORIZE_URL = "https://app.cal.com/auth/oauth2/authorize";
const CAL_OAUTH_TOKEN_URL = "https://api.cal.com/v2/auth/oauth2/token";
const CAL_ME_URL = "https://api.cal.com/v2/me";
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000;

export const CAL_OAUTH_STATE_COOKIE_NAME = "ac_cal_oauth_state";
export const CAL_OAUTH_SCOPES = [
  "PROFILE_READ",
  "EVENT_TYPE_READ",
  "SCHEDULE_READ",
  "BOOKING_WRITE",
] as const;

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional().default(""),
});

const TokenErrorResponseSchema = z.object({
  error: z.string(),
  error_description: z.string(),
});

const MeResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    id: z.number(),
    username: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable().optional(),
  }),
});

type CalTokenResult = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
  scopes: string[];
};

type CalProfile = {
  id: number;
  username: string;
  name: string;
  avatarUrl: string;
};

type CookieOptions = {
  maxAge?: number;
  expires?: Date;
};

let cachedEncryptionKey: Buffer | undefined;

export class CalConnectionError extends Error {
  constructor(
    public readonly code: "missing_connection" | "reauthorization_required",
    message: string,
  ) {
    super(message);
    this.name = "CalConnectionError";
  }
}

const parseScopes = (scopeString: string) =>
  scopeString
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

const normalizeTokens = (
  tokens: z.infer<typeof TokenResponseSchema>,
): CalTokenResult => ({
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  tokenType: tokens.token_type,
  expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  scopes: parseScopes(tokens.scope),
});

const getTokenEncryptionKey = () => {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  const key = Buffer.from(env.CAL_OAUTH_TOKEN_ENCRYPTION_KEY, "base64url");
  if (key.byteLength !== 32) {
    throw new Error(
      "CAL_OAUTH_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes",
    );
  }

  cachedEncryptionKey = key;
  return key;
};

const serializeCookie = (
  name: string,
  value: string,
  options: CookieOptions = {},
) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const createCalOAuthState = () =>
  crypto.randomBytes(24).toString("base64url");

export const createCalOAuthStateCookie = (state: string) =>
  serializeCookie(CAL_OAUTH_STATE_COOKIE_NAME, state, { maxAge: 10 * 60 });

export const clearCalOAuthStateCookie = () =>
  serializeCookie(CAL_OAUTH_STATE_COOKIE_NAME, "", {
    maxAge: 0,
    expires: new Date(0),
  });

export const buildAuthorizeUrl = (state: string) => {
  const url = new URL(CAL_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.CAL_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.CAL_OAUTH_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", CAL_OAUTH_SCOPES.join(" "));
  return url.toString();
};

export const encryptToken = (token: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
};

const decryptToken = (payload: string) => {
  const [version, iv, authTag, encrypted] = payload.split(":");
  if (!version || !iv || !authTag || !encrypted || version !== "v1") {
    throw new Error("Invalid encrypted token payload");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

const exchangeTokens = async (
  payload:
    | {
        grant_type: "authorization_code";
        code: string;
      }
    | {
        grant_type: "refresh_token";
        refresh_token: string;
      },
) => {
  const response = await axios.post(
    CAL_OAUTH_TOKEN_URL,
    {
      client_id: env.CAL_OAUTH_CLIENT_ID,
      client_secret: env.CAL_OAUTH_CLIENT_SECRET,
      redirect_uri:
        payload.grant_type === "authorization_code"
          ? env.CAL_OAUTH_REDIRECT_URI
          : undefined,
      ...payload,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return normalizeTokens(TokenResponseSchema.parse(response.data));
};

export const exchangeCodeForTokens = async (code: string) => {
  return exchangeTokens({
    grant_type: "authorization_code",
    code,
  });
};

export const refreshAccessToken = async (refreshToken: string) => {
  try {
    return await exchangeTokens({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  } catch (error) {
    const tokenError =
      axios.isAxiosError(error) && error.response?.data
        ? TokenErrorResponseSchema.safeParse(error.response.data)
        : null;

    if (
      tokenError?.success &&
      tokenError.data.error === "invalid_grant" &&
      tokenError.data.error_description === "invalid_refresh_token"
    ) {
      throw new CalConnectionError(
        "reauthorization_required",
        "Your Cal.com connection expired. Please reconnect it.",
      );
    }

    throw error;
  }
};

export const getCalProfile = async (
  accessToken: string,
): Promise<CalProfile> => {
  const response = await axios.get(CAL_ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const parsed = MeResponseSchema.parse(response.data);
  return {
    id: parsed.data.id,
    username: parsed.data.username,
    name: parsed.data.name,
    avatarUrl: parsed.data.avatarUrl ?? "",
  };
};

export const saveCalConnection = async ({
  userId,
  profile,
  tokens,
}: {
  userId: string;
  profile: CalProfile;
  tokens: CalTokenResult;
}) => {
  await db.calConnection.upsert({
    where: {
      userId,
    },
    create: {
      userId,
      calUserId: profile.id,
      calUsername: profile.username,
      calName: profile.name,
      calAvatarUrl: profile.avatarUrl,
      encryptedAccessToken: encryptToken(tokens.accessToken),
      encryptedRefreshToken: encryptToken(tokens.refreshToken),
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    },
    update: {
      calUserId: profile.id,
      calUsername: profile.username,
      calName: profile.name,
      calAvatarUrl: profile.avatarUrl,
      encryptedAccessToken: encryptToken(tokens.accessToken),
      encryptedRefreshToken: encryptToken(tokens.refreshToken),
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    },
  });
};

export const deleteCalConnection = async (userId: string) => {
  await db.calConnection.deleteMany({
    where: {
      userId,
    },
  });
};

export const getValidAccessToken = async (
  userId: string,
  options: {
    forceRefresh?: boolean;
  } = {},
) => {
  const connection = await db.calConnection.findUnique({
    where: {
      userId,
    },
  });

  if (!connection) {
    throw new CalConnectionError(
      "missing_connection",
      "Connect your Cal.com account to continue.",
    );
  }

  const shouldRefresh =
    (options.forceRefresh ?? false) ||
    connection.accessTokenExpiresAt.getTime() <=
      Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS;

  if (!shouldRefresh) {
    return decryptToken(connection.encryptedAccessToken);
  }

  try {
    const refreshedTokens = await refreshAccessToken(
      decryptToken(connection.encryptedRefreshToken),
    );

    await db.calConnection.update({
      where: {
        userId,
      },
      data: {
        encryptedAccessToken: encryptToken(refreshedTokens.accessToken),
        encryptedRefreshToken: encryptToken(refreshedTokens.refreshToken),
        accessTokenExpiresAt: refreshedTokens.expiresAt,
        scopes: refreshedTokens.scopes,
      },
    });

    return refreshedTokens.accessToken;
  } catch (error) {
    if (
      error instanceof CalConnectionError &&
      error.code === "reauthorization_required"
    ) {
      await deleteCalConnection(userId);
    }

    throw error;
  }
};
