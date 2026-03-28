# Agents Guide

## Product Summary

Autocheckin is a Next.js app that helps a signed-in user keep recurring check-ins with people via Cal.com.

Core flow:

1. User signs in with Google.
2. User connects their Cal.com account with OAuth.
3. User adds a contact by pasting a Cal.com event link and choosing a frequency.
4. The app looks up the Cal.com event type, schedules the first booking, stores it in Postgres, and uses Inngest to queue future re-booking work.

This is a Pages Router app, not an App Router app.

## Stack

- Next.js 14 with the Pages Router under `src/pages`
- TypeScript with `strict`, `noUncheckedIndexedAccess`, and `~/*` path aliases
- tRPC + React Query for the app API
- Prisma + PostgreSQL
- NextAuth with Google provider and Prisma adapter
- Tailwind CSS + shadcn-style UI primitives in `src/components/ui`
- Inngest for delayed scheduling jobs
- Cal.com APIs for event lookup, availability, and booking
- Sentry for error capture
- PostHog for analytics, proxied through `/ingest`

## Repo Layout

- `src/pages`
  Next.js routes. Important pages are `/`, `/login`, `/home`, `/settings`, and `/logout`.
- `src/pages/api/trpc/[trpc].ts`
  tRPC entrypoint. Errors are logged and forwarded to Sentry.
- `src/pages/api/auth/[...nextauth].ts`
  NextAuth entrypoint.
- `src/pages/api/cal/oauth/start.ts`
  Starts the Cal.com OAuth flow for the signed-in user.
- `src/pages/api/cal/oauth/callback.ts`
  Handles the Cal.com OAuth callback, persists tokens, and triggers schedule reseeding.
- `src/pages/api/inngest.ts`
  Inngest serve handler.
- `src/server/api/routers/contact-router.ts`
  Main business logic for listing, creating, updating, and deleting contacts.
- `src/server/api/routers/user-router.ts`
  Reads the user Cal.com connection state and handles Cal.com disconnects.
- `src/server/lib/cal-oauth.ts`
  Cal.com OAuth URL building, token exchange/refresh, encrypted token storage, and connection state cookies.
- `src/server/lib/cal-api.ts`
  Cal.com integration and the scheduling algorithm.
- `src/server/lib/inngest`
  Inngest client plus the delayed `schedule-meeting` and `reseed-user-schedules` functions.
- `src/server/auth.ts`
  NextAuth config. Session is augmented with `user.id`.
- `src/server/db.ts`
  Prisma client singleton.
- `prisma/schema.prisma`
  Postgres schema for users, contacts, bookings, and NextAuth tables.
- `src/components`
  Feature components and dialogs used by the dashboard.
- `src/components/ui`
  Reusable UI primitives.

## Data Model

Main application models:

- `User`
  Owns contacts, bookings, sessions, and the Cal OAuth connection.
- `CalConnection`
  Stores the encrypted Cal OAuth tokens, expiry, scopes, and Cal profile identifiers for a user.
- `Contact`
  Stores the Cal.com event link, event type metadata, and `checkInFrequency`.
- `Booking`
  Stores booked Cal.com meetings for a contact.

Enums:

- `CheckInFrequency`: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`, `BIYEARLY`, `YEARLY`

The Prisma schema also includes the standard NextAuth tables: `Account`, `Session`, and `VerificationToken`.

## Scheduling Flow

The core behavior lives in `src/server/api/routers/contact-router.ts` and `src/server/lib/cal-api.ts`.

- `contact.create`
  Validates the pasted Cal.com URL, resolves the Cal.com event type, creates the contact, books the first meeting, and stores the booking.
- `contact.update`
  Updates name/frequency, cancels queued Inngest work for that contact, cancels future Cal.com bookings, deletes those booking rows, and schedules the next booking.
- `contact.delete`
  Cancels queued Inngest work, cancels future Cal.com bookings, and deletes the contact.
- `scheduleNextBooking`
  Chooses a target window based on frequency, fetches availability and slots from Cal.com, picks a slot within availability, books it, and queues the next `schedule-meeting` event with 1-3 days of random jitter.
- `scheduleMeetingFunction`
  Sleeps until the queued runtime, then schedules the next booking and persists it.
- `reseedUserSchedulesFunction`
  Runs after a user reconnects Cal.com, cancels queued jobs for all contacts, and rebuilds exactly one forward scheduling chain per contact.

Important implementation detail:

- `getEventTypeInfo` now uses the Cal.com v2 `GET /event-types` endpoint with the user’s OAuth access token plus the `username` and `eventSlug` query parameters.

## Environment

Required env vars are defined in `src/env.js`.

Server env:

- `DATABASE_URL`
- `NODE_ENV`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CAL_OAUTH_CLIENT_ID`
- `CAL_OAUTH_CLIENT_SECRET`
- `CAL_OAUTH_REDIRECT_URI`
- `CAL_OAUTH_TOKEN_ENCRYPTION_KEY`

Client env:

- `NEXT_PUBLIC_POSTHOG_KEY`

Notes:

- The repo validates env eagerly via `next.config.js` importing `src/env.js`.
- Use `SKIP_ENV_VALIDATION=1` only when you intentionally want to bypass env checks.
- `start-database.sh` reads `DATABASE_URL` from `.env` and may rewrite `.env` if it detects the default password.

## Commands

Use `corepack pnpm ...`. The repo is pinned to `pnpm@10.32.1`.

- `pnpm dev`
  Run Next.js locally.
- `pnpm build`
  Production build.
- `pnpm start`
  Start the built app.
- `pnpm lint`
  Main static check.
- `pnpm db:push`
  Push schema changes without creating a migration.
- `pnpm migrate:dev`
  Create/apply a development migration.
- `pnpm migrate:deploy`
  Apply committed migrations.
- `pnpm db:studio`
  Open Prisma Studio.
- `pnpm inngest`
  Run the Inngest dev server.
- `./start-database.sh`
  Start a local Postgres container based on `.env`.

There is no test suite configured in this repo right now. In practice, verification is `pnpm lint` plus targeted manual testing.

## UI Notes

- The dashboard is `src/pages/home.tsx`.
- Account settings are managed on `src/pages/settings.tsx`.
- Contact forms use desktop `Dialog` and mobile `Drawer` variants.
- The dashboard now shows Cal OAuth connection state and routes reconnects through `/api/cal/oauth/start`.
- Cal.com disconnects are handled from Settings, accessed via the avatar dropdown.
- Shared UI primitives are under `src/components/ui`.
- Tailwind theme tokens live in `src/styles/globals.css` and `tailwind.config.ts`.
- Fonts are wired in `_app.tsx` via Next font loaders and exposed as CSS variables.

## Observability And External Services

- Sentry is initialized in `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`.
- tRPC handler errors are explicitly captured in `src/pages/api/trpc/[trpc].ts`.
- `scheduleNextBooking` captures a Sentry message when no suitable slot is found.
- PostHog is initialized in `src/pages/_app.tsx`.
- `/ingest/*` is rewritten by `src/middleware.ts` to PostHog endpoints.
- Next config uses a Sentry tunnel route at `/monitoring`. Keep that separate from the PostHog middleware route.

## Conventions And Gotchas

- Use the `~/*` alias for imports from `src`.
- The app relies on `superjson` in both tRPC server and client. Do not remove it unless you replace all date serialization assumptions.
- `home.tsx` expects booking dates to deserialize back into `Date` objects.
- The README is generic T3 boilerplate and not a reliable source of project-specific behavior.
- Cal OAuth tokens are encrypted in Prisma using `CAL_OAUTH_TOKEN_ENCRYPTION_KEY`; keep the payload format backward compatible if you rotate implementations.
- Cal access tokens expire after 30 minutes and are refreshed server-side. If refresh returns `invalid_grant`, the connection is deleted and the user must reconnect.
- Contact mutations intentionally keep Cal network calls out of Prisma transactions so token refresh and remote cleanup are not blocked by a long-running DB transaction.
- No Node version is pinned in the repo. If you introduce one, update this file too.

## Where To Make Common Changes

- Add or change application data:
  Edit `prisma/schema.prisma`, create/apply a migration, and inspect any impacted queries and session fields.
- Add a new server capability:
  Create or extend a router in `src/server/api/routers`, then wire it into `src/server/api/root.ts`.
- Add a new scheduled workflow:
  Extend `src/server/lib/inngest/client.ts`, add a function under `src/server/lib/inngest`, and register it in `src/pages/api/inngest.ts`.
- Change booking logic:
  Start in `src/server/lib/cal-api.ts`, then verify `contact-router.ts` and the Inngest function still match the new behavior.
- Change auth/session behavior:
  Update `src/server/auth.ts` and any UI that consumes session/user info.
- Add a new env var:
  Update `src/env.js` in `server` or `client`, and add it to `runtimeEnv`.

## Suggested Verification

For most changes, run:

- `pnpm lint`

For behavior changes, manually verify the relevant flow:

- Auth changes:
  `/login`, successful sign-in redirect to `/home`, `/logout`, and unauthenticated redirect back to `/login`.
- Contact changes:
  create, update, and delete a contact from `/home`.
- Scheduling changes:
  confirm a `Booking` row is created and that Inngest receives the next scheduling event.
- Prisma changes:
  run `pnpm migrate:dev` or `pnpm db:push`, then check Prisma Client generation succeeds.
- Analytics/middleware changes:
  verify `/ingest` still proxies cleanly and does not conflict with other rewrites.

## If You Are An Agent Making Changes

- Keep edits narrow and match existing patterns.
- Prefer changing the tRPC routers and shared server helpers over duplicating logic in pages or components.
- When changing scheduling or cancellation behavior, trace all three layers:
  `contact-router.ts`, `cal-api.ts`, and `src/server/lib/inngest/schedule-meeting.ts`.
- If you add significant new subsystems, update this file so the next agent starts with accurate context.
