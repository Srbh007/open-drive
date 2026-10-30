# Build Prompts — Open Drive

Copy-paste prompts for the coding agent (Google Jules first, DeepSeek as backup), one per phase. Run them in order; start a phase only after the previous PR is reviewed and merged. Reference code for the trickiest files is at the end.

---

## Phase 0 — Project setup

```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/RULES.md and docs/IMPLEMENTATION_PLAN.md first. Follow RULES.md strictly.

Goal: production-ready scaffold for Open Drive.
- pnpm, Next.js 15 App Router with src/ dir, TypeScript strict, Tailwind, ESLint.
- shadcn/ui initialised; DESIGN.md color tokens as CSS variables (light + dark), fonts Public Sans and JetBrains Mono via next/font.
- Drizzle ORM with @neondatabase/serverless. Put the FULL schema from ARCHITECTURE.md "Data model" in src/server/db/schema.ts; src/server/db/index.ts exports `db`. drizzle.config.ts; generate the first migration in drizzle/.
- src/env.ts: zod-validated env with every variable listed in ARCHITECTURE.md (skip validation when SKIP_ENV_VALIDATION=1 for CI builds).
- src/server/errors.ts: AppError(code, message, status) + withRoute(handler) wrapper returning the { ok, data | error } envelope.
- src/server/log.ts: tiny structured logger.
- Vitest + Playwright configured. .env.example with names only. .github/workflows/ci.yml runs pnpm install, typecheck, lint, test, build.
- src/app/page.tsx: simple placeholder using the tokens.

Acceptance: pnpm dev works; pnpm typecheck, lint, test, build pass; migration generated.
Tests: env validation throws on a missing var; withRoute maps AppError to the envelope.
Work on branch feat/phase-0-setup and open one PR.
```

## Phase 1 — Login, owner approval, team

```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/RULES.md and docs/IMPLEMENTATION_PLAN.md first. Follow RULES.md strictly.

Goal: Google login where every new user waits for owner approval.
- src/server/auth.ts: Auth.js v5, Google provider (scopes openid email profile), JWT session that carries our users.id. In the signIn/jwt callback upsert users by google_sub: new rows status 'pending', role 'viewer'; if email equals OWNER_EMAIL set role 'owner', status 'approved'.
- src/app/api/auth/[...nextauth]/route.ts.
- src/middleware.ts: signed-out → /login; pending → /pending; suspended → sign out. Public paths: /login, /s/*, /i/*, /api/s/*, /api/auth/*, /api/cron/*, /manifest.webmanifest, static files.
- src/server/guard.ts: requireUser() and requireDriveAccess() exactly as in the reference code at the end of docs/PROMPTS.md.
- src/server/audit.ts: writeAudit(action, target, userId?, linkSlug?, ip?).
- Pages: src/app/login/page.tsx, src/app/pending/page.tsx (re-checks every 30 s), src/app/(portal)/layout.tsx (empty Explorer shell from DESIGN.md §3), src/app/(portal)/team/page.tsx with tabs Pending / Members (approve, deny, suspend, role select viewer/editor/admin; owner not editable).
- API: GET /api/admin/users, PATCH /api/admin/users/[id] (admin/owner only, zod-validated, audited).

Acceptance: owner auto-approved; another account sees only /pending and gets 403 from APIs; approve lets them in; suspend blocks the next request.
Tests: Vitest for role/status rules; Playwright with a mocked session for login → pending → approve.
Work on branch feat/phase-1-auth and open one PR.
```

## Phase 2 — Connect Drives, per-user access

```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/RULES.md and docs/IMPLEMENTATION_PLAN.md first. Follow RULES.md strictly.

Goal: admins connect any number of Google Drive accounts; the owner controls which Drives each user sees.
- src/server/crypto.ts: use the reference code at the end of docs/PROMPTS.md.
- src/server/google/oauth.ts: build the consent URL (scope https://www.googleapis.com/auth/drive openid email, access_type=offline, prompt=consent, include_granted_scopes=true, PKCE S256, state stored in a signed httpOnly cookie); exchange code; revoke token.
- GET /api/connect/drive (admin) and GET /api/connect/drive/callback: verify state, exchange code, read the Google account (sub, email), about.get (storageQuota, user), root folder id (files.get 'root' fields=id); encrypt refresh token; upsert drive_accounts by google_sub with a rotating color; create sync_state 'initial'; redirect to /settings.
- src/server/redis.ts (Upstash), src/server/google/tokens.ts: getAccessToken(driveAccountId) with Redis cache (TTL expires_in-300), refresh, invalid_grant → status 'reconnect'.
- src/server/google/limit.ts: per-Drive semaphore (max 3) + fetchWithBackoff per RULES.md §6.
- GET /api/drives: Drives visible to the user, with quota and status.
- Settings → Drives section: Connect Drive, list (label editable, color, storage bar, status, Reconnect, Disconnect = revoke + delete).
- Team → Drive access tab: pick a member, searchable list of all Drives with "Can see" and "Can edit" checkboxes, Select all / Clear; saves to user_drive_access.

Acceptance: 3 Drives connect; refresh_token_enc is ciphertext; quotas display; a viewer only sees assigned Drives; disconnect removes the Drive and its files rows.
Tests: crypto round trip + tamper fails; token cache hit/miss/refresh with mocked fetch; state mismatch rejected.
Work on branch feat/phase-2-drives and open one PR.
```

## Phase 3 — Index, sync, Explorer

```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/RULES.md and docs/IMPLEMENTATION_PLAN.md first. Follow RULES.md strictly.

Goal: every Drive indexed in Postgres, kept in sync, browsed through a Windows Explorer-style UI.
- src/server/sync.ts + src/server/google/changes.ts: initial scan exactly as ARCHITECTURE.md "Sync" (files.list pageSize 1000, minimal fields, upsert per page, save scan_page_token each page, then getStartPageToken); incremental changes.list with includeRemoved; quota refresh.
- GET /api/cron/sync: Bearer CRON_SECRET; process Drives oldest last_synced_at first until ~240 s used; resume next run. vercel.json cron "*/5 * * * *".
- GET /api/folders?drive=&parent=, GET/PATCH/DELETE /api/files/[id] (rename, move, set title, trash), GET /api/search (pg_trgm on coalesce(title,name), add the GIN index migration). All guarded.
- Explorer UI per DESIGN.md §3–§5: virtualized Sidebar with Drive filter, Breadcrumbs, Details / Large icons / Gallery, sort, Ctrl/Shift multi-select, context menu, keyboard shortcuts, preview pane, TanStack Query + TanStack Virtual. Hover/single-click reveals a CopyLinkButton (wire it to POST /api/links in Phase 5; for now render it disabled with tooltip "Available after links are enabled").
- Drag files from desktop onto the pane: show the drop overlay (upload wiring comes in Phase 5).

Acceptance: a large Drive indexes across cron runs with no duplicates; a rename in Google appears within one run; folders open from the index < 300 ms; search < 500 ms.
Tests: upsert/dedupe, trashed/removed handling, page-token resume; Playwright browse, sort, search, multi-select.
Work on branch feat/phase-3-explorer and open one PR.
```

## Phase 4 — Viewers and Edit in Google

```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/RULES.md and docs/IMPLEMENTATION_PLAN.md first. Follow RULES.md strictly.

Goal: open every common file type inside the portal; edit in Google with one click.
- GET /api/thumb/[id]?size=s|m|l: files.get fields=thumbnailLink, fetch it with the Drive token (adjust =s220/=s600/=s1600), stream bytes, Cache-Control private max-age=86400, ETag = files.version, 304 on If-None-Match.
- GET /api/stream/[id]: use the reference code at the end of docs/PROMPTS.md.
- src/lib/viewers.ts: MIME → viewer map. src/components/viewers: ViewerModal (arrows move through the folder), ImageViewer (zoom/pan), VideoPlayer (native video + speed + PiP), PdfViewer (iframe/object on the stream URL), DocxViewer (docx-preview), SheetViewer (SheetJS, virtualized read-only grid, frozen header, sheet tabs), CodeViewer (Shiki, line numbers, wrap). Unknown types: details + Download.
- POST /api/files/[id]/google-edit (editor + can_edit): add permission { type:'user', role:'writer', emailAddress: user.email } with sendNotificationEmail=false (skip if it already exists), return webViewLink; the UI opens it in a new tab. Show the button for Google Docs/Sheets/Slides and Word/Excel/PowerPoint files.

Acceptance: MP4 seeks without full download; PDF, docx, xlsx, code open; an xlsx opens in Google Sheets and saved edits update the same file.
Tests: Range parsing; MIME map; 206 passthrough with mocked upstream; Playwright opens one fixture per viewer.
Work on branch feat/phase-4-viewers and open one PR.
```

## Phase 5 — Upload page and links

```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/RULES.md and docs/IMPLEMENTATION_PLAN.md first. Follow RULES.md strictly.

Goal: bulk upload straight to Google; one-click edit/view/image links that work without login.
- src/server/google/upload.ts: use the reference code at the end of docs/PROMPTS.md.
- POST /api/upload-session, POST /api/upload-complete (index the file, save title, return file + links).
- src/lib/use-resumable-upload.ts: 8 MB chunks (multiple of 256 KB), 3 files in parallel, Content-Range per chunk, query status after failure and resume, retry with backoff, progress events.
- Upload page per DESIGN.md §4.6: drop zone + Drive/folder picker; list with 48 px thumbnail, editable product title (saves on blur via PATCH /api/files/[id]), size, progress, Copy link, Copy image link (images), Delete (confirm; trashes in Drive and revokes links), "Copy all image links".
- src/server/links.ts: 21-char slug (nanoid), create/reuse per (file, kind), check revoked/expired/password (scrypt).
- POST /api/links (kind defaults to settings copy_link_default), PATCH/DELETE /api/links/[slug]; enable CopyLinkButton everywhere; toast "Link copied — anyone can edit" / "— anyone can view".
- Public: /s/[slug] page (preview + download; for kind 'edit' also an upload box for folders and a Replace button for files), POST /api/s/[slug]/upload-session, /i/[slug] route (strip .jpg/.png/.webp, images only, Cache-Control public s-maxage=31536000 immutable). Upstash rate limits on all three.
- Settings → Links: "Copy link gives" Edit / View; edit-link expiry. Links page per DESIGN.md §4.7.
- Verify the browser can PUT to the Google session URL (CORS) in Chrome and Edge; if not, add a relay route that forwards 4 MB chunks.

Acceptance: 50 images upload in one drop; titles save; a signed-out browser opens a copied link with edit rights; an image link renders in a plain <img> on another origin; Delete trashes and revokes; a 2 GB upload resumes after a network drop.
Tests: chunk math, slug and link rules; Playwright upload → copy → open signed-out → delete.
Work on branch feat/phase-5-upload-links and open one PR.
```

## Phase 6 — PWA, dashboard, annotations, deploy

```
Read docs/PRD.md, docs/ARCHITECTURE.md, docs/DESIGN.md, docs/RULES.md and docs/IMPLEMENTATION_PLAN.md first. Follow RULES.md strictly.

Goal: installable app, dashboard, captions/tags/favorites, production-ready.
- src/app/manifest.ts + public/sw.js (app shell cache-first, /api/thumb cache-first, folder JSON stale-while-revalidate, offline page) + icons.
- Dashboard (src/app/(portal)/page.tsx): total storage bar segmented per Drive, per-Drive cards (storage, file count, sync status), recent files.
- Caption, tags, favorite in the preview pane (PATCH /api/files/[id]); Favorites view; search includes caption and tags.
- Empty/loading/error states and the "?" shortcut sheet everywhere per DESIGN.md §5–§6.
- Production: vercel.json crons, README deploy section, post-deploy Playwright smoke against PREVIEW_URL.

Acceptance: installs in Chrome/Edge and opens in its own window; dashboard matches Google quotas; favorites/tags filter search; full smoke test passes on the deployed URL.
Tests: quota totals; tag filter; Playwright favorite/tag round trip; service worker registers.
Work on branch feat/phase-6-pwa-deploy and open one PR.
```

---

## Reference code

### src/server/crypto.ts

```ts
import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/env'

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const key = Buffer.from(env.ENCRYPTION_KEY, 'base64')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must decode to 32 bytes')
  cachedKey = key
  return key
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, ciphertext].map((b) => b.toString('base64url')).join('.')
}

export function decrypt(token: string): string {
  const [ivPart, tagPart, ctPart] = token.split('.')
  if (!ivPart || !tagPart || !ctPart) throw new Error('Invalid encrypted value')
  const iv = Buffer.from(ivPart, 'base64url')
  if (iv.length !== 12) throw new Error('Invalid IV length')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
```

### src/server/guard.ts

```ts
import 'server-only'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/server/auth'
import { db } from '@/server/db'
import { users, userDriveAccess } from '@/server/db/schema'
import { AppError } from '@/server/errors'

export type CurrentUser = typeof users.$inferSelect

export async function requireUser(): Promise<CurrentUser> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new AppError('UNAUTHENTICATED', 'Sign in required', 401)

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new AppError('UNAUTHENTICATED', 'Sign in required', 401)
  if (user.status !== 'approved') throw new AppError('FORBIDDEN', 'Waiting for owner approval', 403)
  return user
}

export async function requireDriveAccess(
  user: CurrentUser,
  driveAccountId: string,
  needEdit = false,
): Promise<void> {
  if (user.role === 'owner' || user.role === 'admin') return
  if (needEdit && user.role === 'viewer') throw new AppError('FORBIDDEN', 'Edit rights required', 403)

  const [access] = await db
    .select()
    .from(userDriveAccess)
    .where(and(eq(userDriveAccess.userId, user.id), eq(userDriveAccess.driveAccountId, driveAccountId)))
    .limit(1)

  if (!access) throw new AppError('FORBIDDEN', 'No access to this Drive', 403)
  if (needEdit && !access.canEdit) throw new AppError('FORBIDDEN', 'Edit rights required', 403)
}
```

### src/app/api/stream/[id]/route.ts

```ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/server/db'
import { files } from '@/server/db/schema'
import { AppError } from '@/server/errors'
import { requireDriveAccess, requireUser } from '@/server/guard'
import { getAccessToken } from '@/server/google/tokens'

export const runtime = 'nodejs'

const PASS_HEADERS = ['content-type', 'content-length', 'content-range', 'etag', 'last-modified'] as const

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ ok: false, error: { code, message } }, { status })
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params
    const fileId = z.string().uuid().parse(id)
    const user = await requireUser()

    const [file] = await db
      .select({ driveAccountId: files.driveAccountId, providerFileId: files.providerFileId, mimeType: files.mimeType })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)
    if (!file) return errorResponse('NOT_FOUND', 'File not found', 404)

    await requireDriveAccess(user, file.driveAccountId)
    const token = await getAccessToken(file.driveAccountId)

    const range = req.headers.get('range')
    const upstream = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.providerFileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
        signal: req.signal,
      },
    )

    if (!upstream.ok || !upstream.body) {
      if (upstream.status === 404) return errorResponse('NOT_FOUND', 'File not found in Drive', 404)
      if (upstream.status === 416) return new Response(null, { status: 416, headers: { 'Content-Range': upstream.headers.get('content-range') ?? '' } })
      return errorResponse('UPSTREAM_ERROR', 'Google Drive did not return the file', 502)
    }

    const headers = new Headers()
    for (const name of PASS_HEADERS) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    if (!headers.has('content-type')) headers.set('content-type', file.mimeType)
    headers.set('accept-ranges', 'bytes')
    headers.set('cache-control', 'private, max-age=0')

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.code, err.message, err.status)
    if (err instanceof z.ZodError) return errorResponse('VALIDATION', 'Invalid file id', 400)
    if (err instanceof DOMException && err.name === 'AbortError') return new Response(null, { status: 499 })
    throw err
  }
}
```

### src/server/google/upload.ts

```ts
import 'server-only'
import { env } from '@/env'

type CreateResumableSessionInput = {
  accessToken: string
  name: string
  mimeType: string
  size: number
  parentId: string
  /** Set to replace an existing file's content instead of creating a new file. */
  replaceFileId?: string
}

export async function createResumableSession(input: CreateResumableSessionInput): Promise<string> {
  const { accessToken, name, mimeType, size, parentId, replaceFileId } = input
  const base = 'https://www.googleapis.com/upload/drive/v3/files'
  const url = replaceFileId
    ? `${base}/${encodeURIComponent(replaceFileId)}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,version`
    : `${base}?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,version`

  const response = await fetch(url, {
    method: replaceFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size),
      // Lets the browser PUT chunks to the session URL (CORS). Verify in Phase 5.
      Origin: env.NEXT_PUBLIC_APP_URL,
    },
    body: JSON.stringify(replaceFileId ? { name } : { name, parents: [parentId] }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create resumable session: ${response.status}`)
  }

  const location = response.headers.get('Location')
  if (!location) throw new Error('Google did not return an upload session URL')
  return location
}
```
