# benchmarktours-backend

Express 4 + TypeScript + PostgreSQL API for **Japan Lean Experience (JLE)** — a platform for running guided corporate benchmarking tours in Japan. Serves two clients: `benchmarktours-admin-web` (React admin console) and `benchmarktours-mobile-app` (Expo app for guides and participants). Both live as sibling repos under the same parent directory.

## Commands

```bash
npm run dev          # ts-node-dev, respawn + transpile-only
npm run build        # tsc -> dist/
npm start            # node dist/index.js
npm run start:prod   # ts-node --transpile-only src/index.ts  <- what Docker/Railway actually runs
```

There is no test runner. `test-gdpr-rights.sh` is a curl+psql smoke script for GDPR data-subject rights; it expects a local dev server and a `benchmarktours-db` Docker container.

No `docker-compose.yml` is committed even though the Dockerfile comments reference one.

## Architecture

Feature-sliced under `src/api/<feature>/`, each slice being `<name>.routes.ts` → `<name>.controller.ts` → `<name>.service.ts` (some add `<name>.types.ts`). Routers are mounted in `src/index.ts`. Services own all SQL and call `query()` from `src/config/db.ts` — there is no ORM and no repository layer.

Two pre-existing slices sit outside that convention and predate it: `src/controllers/aiController.ts` + `src/routes/ai.ts` + `src/services/AIService.ts`. Leave them where they are; put new AI work in the existing files rather than half-migrating.

**Mount order matters.** `/api/public` (unauthenticated survey access) is mounted before the authed routers in `src/index.ts` on purpose. Several routers mount at bare `/api` and define their own full paths (`/tours/:tourId/notes`), so a new path can silently collide with another slice — grep before adding one.

### Migrations

Hand-rolled, not `node-pg-migrate` despite the dependency and the `migrate:*` scripts. `src/config/migrate.ts` runs at every boot: it reads `migrations/*.sql`, sorts **by filename**, and executes anything not yet recorded in the `migrations` table.

Consequences:
- Name new files with a millisecond epoch prefix (`1771600000000_short-description.sql`) so they sort after existing ones. The first dozen use `001_`–`012_` and will always sort first.
- Migrations are **forward-only and run in production automatically on deploy**. There is no down path. Write them idempotently (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) — they must be safe if a deploy retries.
- A failing migration aborts server startup.
- `db/init.sql` only enables `pgcrypto`; it is not the schema.

### Auth and access control

JWT bearer tokens, `HS256` pinned explicitly in `src/middleware/auth.middleware.ts` (do not loosen this). Roles are `Admin`, `Guide`, `User`, enforced by a `CHECK` constraint on `users.role`.

Three layers that must all be considered on any tour-scoped route:

1. `authenticateToken` — identity.
2. `src/middleware/tourMembership.middleware.ts` — **tenant isolation**. Admins bypass; everyone else must appear in `tour_participants`. There is a resolver per entry point (`requireTourMembershipByActivityId`, `…ByNoteId`, `…ByDiscussionId`, `…ByMessageId`, `…ByReviewId`, `…ByShoppingItemId`, `…BySurveyId`, `…ByBody`). **Any new tour-scoped route needs one of these** — this was added as a security fix, so an unguarded route is a regression, not a gap.
3. `src/utils/tourAccess.ts` — **read-only after tour end**. Services call `checkTourReadOnly*()`, which throws `'This tour has ended and is now read-only'`; controllers translate that substring into a 403. Both clients match on that exact string, so don't reword it.

Deliberate exception: users can always delete or edit their *own* notes, questions and reactions even after a tour ends — own-content erasure must never be blocked (GDPR). Ownership there is enforced in the SQL `WHERE`, not by middleware. See the comments in `src/api/notes/note.routes.ts`.

Rate limiting (`src/middleware/rateLimit.middleware.ts`) covers login/setup/reset (`authLimiter`, failures only), unauthenticated writes (`sensitiveActionLimiter`), and public surveys (`publicSurveyLimiter`). Limits are relaxed outside production. `app.set('trust proxy', 1)` in `index.ts` is required for these keys to be real client IPs behind Railway's edge.

### GDPR

This is a running theme, not an afterthought: erasure integrity with FK/trigger-backed file cleanup, PII scrubbing, a retention purge on a schedule (`src/services/RetentionService.ts`, started at boot), self-service data export, public-survey respondent erasure, and a moderation/report workflow (`src/api/moderation/`, `message_reports`, `user_blocks`). Participant PII is deliberately stripped from what the AI tooling can see. Treat anything touching user data as in scope for these guarantees.

### AI layer

LangChain with a provider switch (`AI_PROVIDER=openai|gemini`) in `src/services/AIService.ts`. Tools live in `src/tools/scheduleTools.ts`: `view_schedule`, `check_conflicts`, `get_tour_info`, `adjust_activity_times`.

The behavioural contract is encoded in the system prompt and is easy to break:
- Tour context is injected from the session — **tools never take a tour ID**, and responses must never mention tour or activity IDs.
- Everything is JST.
- **Guide** role applies schedule changes immediately (`executeImmediately=true`); **Admin** proposes and needs an approval token. Routes are gated to Guide/Admin.

LangSmith tracing is optional (`LANGSMITH_ENABLED`, EU endpoint by default).

### Files and media

`src/services/FileStorageService.ts` fronts Google Cloud Storage. The DB stores paths; services swap them for **signed URLs on read** (see `transformNoteAttachments` in `note.service.ts` for the pattern). iPhone HEIC uploads are converted to JPEG server-side via `heic-convert` + `sharp`. Deleted rows trigger file cleanup rows in `file_cleanup_log`.

Push notifications go through `src/services/PushService.ts` (`expo-server-sdk`, tokens in `device_push_tokens`).

## Conventions

- **Time is stored UTC, displayed JST.** Use `src/utils/time.ts` (`jstToUTC`, `formatJST`, `JST_TIMEZONE = 'Asia/Tokyo'`). Never hand-roll a `+9`.
- **Response shape is inconsistent and that's load-bearing** — the clients are written against what exists. Older slices (tours, companies, users) return `{ tours }` or `{ message, tour }`; newer ones (notes, chat, discussions, shopping) return `{ success: true, ... }`. Match the slice you are editing; don't normalize.
- Services export named functions (`export const createNote = …`). Only `question.service.ts` uses a default-exported object.
- Controllers wrap everything in try/catch, `console.error` the real error, and return a generic message. Validation uses `express-validator` in some slices and hand-written checks in others.
- Errors cross the service→controller boundary as thrown `Error`s matched by message substring. Fragile, but consistent — follow it rather than inventing an error class for one slice.
- IDs: `users.id` is a UUID, everything else is `SERIAL`.

## Environment

See `.env.example`. Required: `DATABASE_URL`, `JWT_SECRET`, `ALLOWED_ORIGINS` (comma-separated, production only — CORS falls back to localhost ports in dev), GCS credentials, and an AI key. In production `ssl: { rejectUnauthorized: false }` is set on the pool.

`PORT` defaults to 3001, but both clients default to `localhost:3002` — local `.env` sets 3002.

## Deployment

Railway. **JLE-Stage** project (service `backend`) and **JLE-Prod** project (service `benchmarktours-backend`), each with its own Postgres on a 5 GB volume in `europe-west4`. Prod API: `https://benchmarktours-backend-production.up.railway.app/api`.

Branch flow: commit to `staging`, then PR `staging` → `master`. Migrations run on deploy, so a schema change reaches the staging database as soon as it merges to `staging`.
