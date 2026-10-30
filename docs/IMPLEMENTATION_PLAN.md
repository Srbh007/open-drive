# Implementation Plan — Open Drive

Open Drive joins any number of Google Drive accounts into one Explorer-style web portal for a small team. Stack: Next.js 15 (App Router, TypeScript) on Vercel, Auth.js v5 Google login with owner approval, Neon Postgres + Drizzle, Upstash Redis, Google Drive API, installable PWA.

Each phase is one branch and one PR. Paths follow `docs/ARCHITECTURE.md`. Rules in `docs/RULES.md` apply to every phase. Prompts for the coding agent are in `docs/PROMPTS.md`.

## Manual setup the owner does once

1. **Google Cloud project** at console.cloud.google.com.
2. **Enable** the Google Drive API.
3. **OAuth consent screen** (External). Scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive`. Set publishing status to **In production** (in Testing mode, Drive connections expire after 7 days).
4. **OAuth client** (Web application). Authorized redirect URIs, for both local and production:
   - `http://localhost:3000/api/auth/callback/google` and `https://<domain>/api/auth/callback/google` (login)
   - `http://localhost:3000/api/connect/drive/callback` and `https://<domain>/api/connect/drive/callback` (Drive connect)
   - Authorized JavaScript origins: `http://localhost:3000`, `https://<domain>`.
5. **GitHub repository** (private) for the code. Install the Jules GitHub app on it.
6. **Vercel project** (Pro plan) linked to the repo.
7. **Neon Postgres** and **Upstash Redis** from the Vercel Marketplace (they add their env vars automatically).
8. **Env vars** in Vercel and `.env.local`: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ENCRYPTION_KEY` (`openssl rand -base64 32`), `CRON_SECRET`, `OWNER_EMAIL`, `NEXT_PUBLIC_APP_URL`.

## Phase 0 — Project setup

**Goal:** A running skeleton with tooling and CI.
**Tasks:** `create-next-app` (TS, Tailwind, ESLint, App Router, `src/`); shadcn/ui init with the DESIGN tokens; Drizzle + `@neondatabase/serverless`; `src/env.ts` with zod; `src/server/log.ts`; `withRoute` wrapper + `AppError`; Vitest; Playwright; GitHub Actions running typecheck, lint, test, build.
**Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.github/workflows/ci.yml`, `src/app/layout.tsx`, `src/app/globals.css`, `src/env.ts`, `src/server/db/index.ts`, `src/server/db/schema.ts` (full schema from ARCHITECTURE), `src/server/errors.ts`, `src/server/log.ts`.
**Depends on:** nothing.
**Done when:** `pnpm dev` shows a styled placeholder; `pnpm drizzle-kit generate` creates the first migration; CI is green.
**Tests:** env validation throws on missing vars; `withRoute` maps `AppError` to the envelope.

## Phase 1 — Login, owner approval, team screen

**Goal:** Google login; pending until approved; roles; team admin screen.
**Tasks:** Auth.js v5 Google provider (database user sync, JWT session holding the user id); `OWNER_EMAIL` becomes owner on first login; middleware redirects; `/pending` page; `requireUser`; Team page: approve, deny, suspend, role select; audit rows.
**Files:** `src/server/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/server/guard.ts`, `src/server/audit.ts`, `src/app/login/page.tsx`, `src/app/pending/page.tsx`, `src/app/(portal)/layout.tsx`, `src/app/(portal)/team/page.tsx`, `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/components/admin/TeamTable.tsx`.
**Depends on:** Phase 0, login redirect URI.
**Done when:** owner is auto-approved; a second account is stuck on `/pending` and gets 403 from APIs; approving lets them in; suspending signs them out on the next request.
**Tests:** role and status rules; middleware redirects; e2e with a mocked session.

## Phase 2 — Connect Drives and per-user Drive access

**Goal:** Connect unlimited Drives; encrypted tokens; token refresh; storage quotas; per-user access.
**Tasks:** `/api/connect/drive` (state + PKCE in a signed cookie) and callback; `crypto.ts`; `tokens.ts` with Redis cache and refresh; `about.get` for quota and root folder id; Settings → Drives list with Reconnect / Disconnect (revoke at Google); Team → Drive access matrix (Can see / Can edit) with search; `requireDriveAccess`; `GET /api/drives`.
**Files:** `src/server/crypto.ts`, `src/server/redis.ts`, `src/server/google/oauth.ts`, `src/server/google/tokens.ts`, `src/server/google/drive.ts`, `src/server/google/limit.ts`, `src/app/api/connect/drive/route.ts`, `src/app/api/connect/drive/callback/route.ts`, `src/app/api/drives/route.ts`, `src/app/(portal)/settings/page.tsx`, `src/components/admin/DriveAccessMatrix.tsx`.
**Depends on:** Phase 1, Drive redirect URI.
**Done when:** 3 Drives connect; tokens in the DB are ciphertext; quotas show; a viewer sees only assigned Drives; disconnect removes the Drive and its index.
**Tests:** encrypt/decrypt round trip and tamper detection; token cache hit/miss/refresh-on-401 with mocked fetch; state validation.

## Phase 3 — Index, sync and the Explorer

**Goal:** Every Drive indexed; changes synced; full Explorer UI.
**Tasks:** resumable initial scan (stores `scan_page_token` per page); Changes API sync; `/api/cron/sync` with `CRON_SECRET` and a time budget; `vercel.json` cron every 5 min; `/api/folders`, `/api/files/[id]` (rename, move, delete), `/api/search` with pg_trgm; Explorer: Sidebar tree (virtualized Drive list + filter), breadcrumbs, Details / Large icons / Gallery views, sort, multi-select, context menu, hover Copy link button (calls `/api/links` in Phase 5; until then copies a placeholder disabled state), preview pane; TanStack Query + TanStack Virtual.
**Files:** `src/server/sync.ts`, `src/server/google/changes.ts`, `src/app/api/cron/sync/route.ts`, `vercel.json`, `src/app/api/folders/route.ts`, `src/app/api/files/[id]/route.ts`, `src/app/api/search/route.ts`, `src/app/(portal)/drive/[[...path]]/page.tsx`, `src/components/explorer/*`, `drizzle/*_trgm.sql`.
**Depends on:** Phase 2.
**Done when:** a 50k-file Drive finishes indexing across cron runs without duplicates; a rename in Google shows within one cron run; folders open from the index in under 300 ms; search returns in under 500 ms.
**Tests:** upsert and dedupe; trashed and removed changes; page-token resume; e2e browse, sort, search, multi-select.

## Phase 4 — Viewers and Edit in Google

**Goal:** In-portal viewers for common types; one-click editing in Google.
**Tasks:** `/api/thumb/[id]` (fresh `thumbnailLink`, private browser cache, ETag = version); `/api/stream/[id]` (Range, 206, streamed); viewer registry by MIME type; ImageViewer, VideoPlayer, PdfViewer (browser PDF viewer on the stream URL), DocxViewer (`docx-preview`), SheetViewer (SheetJS → virtualized grid, sheet tabs, read-only), CodeViewer (Shiki); `/api/files/[id]/google-edit` adds a writer permission for the user's email and returns `webViewLink`; Download button.
**Files:** `src/app/api/thumb/[id]/route.ts`, `src/app/api/stream/[id]/route.ts`, `src/app/api/files/[id]/google-edit/route.ts`, `src/server/google/permissions.ts`, `src/lib/viewers.ts`, `src/components/viewers/*`.
**Depends on:** Phase 3.
**Done when:** an MP4 seeks without downloading fully; PDF, docx, xlsx and code open in the modal; an xlsx opens in Google Sheets in a new tab and edits save to the same file; every route enforces access.
**Tests:** Range header parsing; MIME → viewer mapping; 206 passthrough with a mocked upstream; e2e open one fixture per viewer.

## Phase 5 — Upload page and links

**Goal:** Bulk uploads straight to Google; upload list; edit / view / image links; public pages.
**Tasks:** `/api/upload-session` and `/api/upload-complete`; `useResumableUpload` hook (8 MB chunks, 3 parallel files, resume, retry); Upload page (drop zone, Drive/folder picker, list with thumbnail, editable title, Copy link, Copy image link, Delete, Copy all image links); `src/server/links.ts` (slug, kind, expiry, password); `/api/links`, `/api/links/[slug]`; `/s/[slug]` page (view: preview + download; edit: also upload into folder / replace file); `/api/s/[slug]/upload-session`; `/i/[slug]` image route with public CDN cache; Settings `copy_link_default`; Links page; rate limits on public routes. Verify browser CORS on the Google session URL; if blocked, add the chunk relay fallback.
**Files:** `src/app/api/upload-session/route.ts`, `src/app/api/upload-complete/route.ts`, `src/server/google/upload.ts`, `src/lib/use-resumable-upload.ts`, `src/app/(portal)/upload/page.tsx`, `src/components/upload/*`, `src/server/links.ts`, `src/server/ratelimit.ts`, `src/app/api/links/route.ts`, `src/app/api/links/[slug]/route.ts`, `src/app/s/[slug]/page.tsx`, `src/app/api/s/[slug]/upload-session/route.ts`, `src/app/i/[slug]/route.ts`, `src/app/(portal)/links/page.tsx`, `src/app/api/settings/route.ts`.
**Depends on:** Phases 3 and 4.
**Done when:** 50 images upload in one drop with progress; titles save; Copy link opens for a signed-out browser with edit rights by default; an image link renders inside a plain `<img>` on another site; Delete trashes in Drive and revokes links; a 2 GB file resumes after a network drop.
**Tests:** chunk math; slug generation; link rule checks (revoked, expired, password, kind); e2e upload → copy → open signed-out → delete.

## Phase 6 — PWA, dashboard, annotations, deploy

**Goal:** Installable app, dashboard, captions/tags/favorites, production deploy.
**Tasks:** `manifest.ts`, `public/sw.js` (shell, thumbnails, offline page); dashboard (total + per-Drive storage, sync status, recent files); caption, tags, favorite editing and Favorites view; search includes them; empty, loading and error states everywhere; keyboard shortcut sheet; Vercel production deploy with env vars and cron; post-deploy smoke test.
**Files:** `src/app/manifest.ts`, `public/sw.js`, `public/icons/*`, `src/app/(portal)/page.tsx`, `src/components/dashboard/*`, `src/components/files/{CaptionEditor,TagInput,FavoriteStar}.tsx`.
**Depends on:** Phases 0–5.
**Done when:** the app installs from Chrome/Edge and opens in its own window; dashboard numbers match Google; favorites and tags filter search; production URL passes the full smoke test.
**Tests:** quota totals; tag filtering; e2e favorite/tag round trip; service worker registers.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Google rate limits with many Drives | Slow first index | Per-Drive limit of 3, backoff, cron spreads Drives over runs |
| Vercel function time limit on big scans | Scan stops midway | Page token saved after every page; next run resumes |
| Browser blocks direct PUT to Google | Uploads fail | Verify in Phase 5; chunk relay fallback |
| Edit link pasted publicly | Files changed by strangers | Image links for public pages, expiry option, revoke, audit log |
| `ENCRYPTION_KEY` leak | Drive access exposed | Only in Vercel env; rotation script re-encrypts tokens |
| Video bandwidth on Vercel | Cost | Monitor usage; add a dedicated video proxy later if needed |
| Unsupported video codecs | Video won't play | Download fallback |
