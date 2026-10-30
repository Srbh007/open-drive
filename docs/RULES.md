# Open Drive — Engineering Rules

Mandatory for every coding agent (Google Jules, DeepSeek) and every human building Open Drive. Stack: Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui, Drizzle + Neon Postgres, Auth.js v5, Upstash Redis, Google Drive REST API v3, deployed on Vercel. If a rule blocks your task, stop and ask. Never work around a rule.

## 1. Code style

- TypeScript `strict: true`. No `any` anywhere: use `unknown` and narrow, or parse with zod. No non-null `!`. Every `as` cast needs a comment explaining why it is safe.
- Validate **every** route input (params, searchParams, JSON body, form data) with a zod schema. A raw `await req.json()` without parsing is a bug.
- Secrets, database access, encryption and Google calls live in `src/server/*`. Every file there starts with `import 'server-only'`.
- Read environment variables only through `src/env.ts` (zod-validated). No `process.env` elsewhere.
- No `console.log`. Use `src/server/log.ts`.
- Route handlers stay thin: parse → authorize → call `src/server/*` → return the envelope.

## 2. Folder conventions

```
src/
  app/          routes and layouts only
  components/   feature components
  components/ui shadcn/ui primitives
  lib/          pure logic: zod schemas, types, formatters, mime map
  server/       server-only: db, auth, guard, crypto, google, ratelimit, links, sync
  env.ts
  middleware.ts
drizzle/        migrations
e2e/            Playwright tests
docs/           PRD, ARCHITECTURE, DESIGN, RULES, IMPLEMENTATION_PLAN, PROMPTS
```

Import direction is one way: `app` and `components` may import `lib`; `app` (server code) may import `server`; `lib` imports neither. Client components never import `server`.

## 3. Naming

- Files and folders: `kebab-case` (components may be `PascalCase.tsx`). Hooks: `useThing`. Functions: verb first (`listChildren`, `renameFile`).
- Zod schemas: `ThingSchema`; types: `z.infer<typeof ThingSchema>`.
- Database tables and columns: `snake_case`. Constants: `SCREAMING_SNAKE_CASE`.

## 4. Errors and response shape

- Every API route returns `{ ok: true, data }` or `{ ok: false, error: { code, message } }` with the right HTTP status.
- Error codes: `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `GONE` 410, `VALIDATION` 400, `CONFLICT` 409, `RATE_LIMITED` 429, `UPSTREAM_ERROR` 502.
- Server code throws `AppError(code, message, status)`. A shared `withRoute` wrapper catches it. Google errors become `UPSTREAM_ERROR`. Never return stack traces or raw Google messages. Log details on the server.

## 5. Security

- **Never send refresh or access tokens to the client**: not in JSON, cookies, HTML, props or logs.
- Encrypt refresh tokens with AES-256-GCM (`src/server/crypto.ts`), key `ENCRYPTION_KEY` (32 bytes, base64), new 12-byte IV per write, stored as `iv.tag.ciphertext` (base64url).
- Every non-public route calls `requireUser()` (session → approved). Every Drive-scoped route also calls `requireDriveAccess(user, driveAccountId, needEdit)`.
- Public routes `/s/*`, `/i/*` and `/api/s/*` check the Upstash rate limit first, then the link (exists, not revoked, not expired, password).
- `Cache-Control`: user file data is `private`. `public` is allowed **only** on `/i/*`.
- Google file IDs never appear in URLs or client props. Use our UUIDs and slugs.
- No secrets in the repo. `.env.example` lists names with empty values. Real values go in Vercel or a git-ignored `.env.local`.
- CSRF: rely on Auth.js same-site cookies; mutating routes accept session cookies only and check `Origin` matches `NEXT_PUBLIC_APP_URL`.
- Uploads: enforce the size cap from settings before creating a Google session. Block executable types (`.exe`, `.bat`, `.cmd`, `.msi`, `.scr`) on public edit-link uploads.
- Write `audit_log` rows for approvals, role changes, Drive connect/disconnect, link create/revoke/view, uploads through links, deletes.

## 6. Google API rules

- Call the Drive REST API with `fetch` from `src/server/google/*`. Every call sets a `fields` parameter. Never `fields=*`.
- Loop `pageToken` until no `nextPageToken`. Never assume one page.
- Retry with exponential backoff + jitter (1, 2, 4, 8, 16 s; max 5 tries) on `403 rateLimitExceeded / userRateLimitExceeded`, `429` and `5xx`. Honor `Retry-After`. Never retry other 4xx.
- At most 3 Google requests in flight per connected Drive (per-Drive semaphore in `src/server/google/limit.ts`).
- Never store `thumbnailLink`; it expires. `/api/thumb/[id]` fetches a fresh one with `files.get` each time it is not in the browser cache.
- Permission changes (`google-edit`) use `sendNotificationEmail=false`.

## 7. Streaming

- Stream routes forward the client's `Range` header to Google, return Google's status (206 or 200), and pass `upstream.body` straight into the `Response`.
- Never call `arrayBuffer()`, `blob()` or build a `Buffer` of a whole file.
- Pass `req.signal` to `fetch` so a closed player cancels the Google request.
- Headers: `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges: bytes`, `Cache-Control`.

## 8. Testing

- Vitest unit tests for `src/lib` and pure helpers in `src/server` (crypto, link rules, range parsing, sync diffing). New pure logic ships with tests.
- Mock Google with recorded fixtures; tests never call real Google.
- One Playwright smoke test per phase in `e2e/phase-N.spec.ts`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` must pass before a PR is opened.

## 9. Git

- One branch and one PR per phase: `feat/phase-<n>-<slug>`. Never mix phases.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`.
- No force pushes, no history rewrites, no direct commits to `main`.
- If the phase adds env variables, update `.env.example` and `docs/ARCHITECTURE.md` in the same PR.

## 10. Definition of done

- [ ] typecheck, lint, test and build pass; no new `any`, `!` or warnings.
- [ ] All inputs zod-validated; `server-only` boundaries intact.
- [ ] Every new route checks session + approval + Drive access; public routes rate-limited.
- [ ] Tokens never reach the client; refresh tokens encrypted.
- [ ] Google calls use `fields`, paging, backoff and the per-Drive limit; no stored `thumbnailLink`.
- [ ] Streams never buffered; Range and 206 handled; Cache-Control rules followed.
- [ ] Unit tests for new logic; the phase's Playwright smoke test passes.
- [ ] No secrets committed; conventional commits; PR description lists what was verified.
