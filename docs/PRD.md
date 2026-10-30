# PRD — Open Drive

**Product:** Open Drive, a private multi-Drive team portal
**Version:** 1.0 (31 Oct 2026)
**Status:** Approved for build

---

## 1. Overview

Open Drive is a private, installable web portal (PWA) for a small team. It unifies the owner's Google Drive accounts (any number; the app has no limit) into one Windows File Explorer-style interface. Files of **any type** live in Google Drive; Open Drive indexes and serves them.

The stack is **Vercel only**: Next.js (App Router + API routes), Neon Postgres, Upstash Redis. No Cloudflare.

Team members browse, preview, upload and share. Anyone can open a **Copy link** without logging in (read + write by default). Product pages such as Amazon listings get a read-only direct image link (`/i/<slug>.jpg`) served from Vercel's CDN.

## 2. Goals

1. One portal to browse every connected Drive, each shown as a root folder with its storage.
2. Desktop feel through an installable PWA. No native app.
3. Instant navigation from our own Postgres index, with no Google call per click.
4. Sharing that works anywhere: no-login links for people, CDN image links for product listings.
5. Full owner control: every user approved by the owner, and Drive visibility assigned per user.
6. All infrastructure managed from the Vercel dashboard.

## 3. Non-goals

- No Cloudflare (Workers or R2).
- No native desktop app and no drive-letter mounting or local sync. The PWA is the only client.
- Not a public file host: files stay private until someone creates a link.
- No Google app verification for now. The OAuth app is set to "In production" without verification.

## 4. Users and roles

| Role | Can do |
|---|---|
| **Owner** (the `OWNER_EMAIL` account) | Everything below, plus: approve users, assign Drives per user, connect and disconnect Drives, change link defaults, suspend users |
| **Admin** | Same as Owner, except changing the Owner |
| **Editor** | Browse, preview, download, upload, rename, move, delete, create links, edit captions and tags |
| **Viewer** | Browse, preview, download, copy links |
| **Guest** (no login) | Open Copy links and image links only |

**Approval flow:** Google sign-in → "Waiting for approval" page → owner approves, sets the role and assigns Drives. Every API request re-checks approval and Drive access on the server. Hiding UI is never the protection.

## 5. Feature requirements

**FR-1: Sign-in and approval.** Google sign-in via Auth.js. New users stay pending until the owner approves them.
*AC:* Unapproved users see only the waiting page, and all data APIs return 403. A suspended user is signed out on their next request.

**FR-2: Unlimited Drive accounts.** Owner and admins connect Google Drive accounts (offline access, `drive` scope). Refresh tokens are encrypted at rest. No account cap in the app.
*AC:* N Drives appear as root folders. Storage used and total per Drive come from `about.get`. Disconnect revokes the token at Google and drops that Drive's index. If a Drive's grant expires, a "Reconnect" badge appears.

**FR-3: Per-user Drive visibility.** The owner chooses exactly which Drives each user can see, and whether they can edit in each.
*AC:* A user's tree, search, dashboard and upload picker show only assigned Drives. Requests for an unassigned Drive return 403, even with a guessed ID.

**FR-4: Index and sync.** Full file index in Postgres; Vercel Cron pulls Drive changes.
*AC:* Folder listings and search come from the index, never live from Google. Changes made directly in Drive appear within about 5 minutes.

**FR-5: Explorer UI (Windows-like).** Tree sidebar, breadcrumbs, details / large icons / gallery views, sort, right-click menu, multi-select, drag-drop move, virtualized rendering.
*AC:* Right-click offers Open, Preview, Download, Copy link, Copy image link (images), Edit in Google, Rename, Move, Delete, Properties. Ctrl/Shift multi-select works. A 5,000-item folder scrolls smoothly.

**FR-6: Copy link.** Hovering or single-clicking any file or folder shows a **Copy link** button. One click copies a portal URL (`/s/<slug>`) that anyone can open **without login**. Default rights are **read + write**: view, download, replace the file, upload into the folder. A Settings switch changes the default to view-only. Optional per-link password and expiry.
*AC:* A signed-out visitor can open the link and act within its rights. The Settings switch governs newly created links. A revoked or expired link returns 410. Google file IDs never appear in links.

**FR-7: Direct image link.** Every image has a read-only URL `/i/<slug>.jpg` for Amazon and other product pages, cached on Vercel's CDN.
*AC:* Google is fetched about once per image. The URL returns image bytes with public cache headers, keeps working until revoked, and is rate-limited.

**FR-8: In-portal viewers.** Images (thumbnail first, then full), video (native player on `/api/stream/[id]` with HTTP Range seeking), PDF, Word via `docx-preview`, Excel as a read-only grid with sheet tabs via SheetJS, code with syntax highlighting. Everything else gets Download.
*AC:* A 1 GB MP4 starts in about 2 s and seeks via 206 responses. Unsupported types never show a broken viewer.

**FR-9: Editing.** "Edit in Google" opens Google Docs/Sheets/Slides in a new tab, for Google files and for Word, Excel and PowerPoint files (Google opens those in Office mode and saves back to the same file). Before opening, the server gives the user's login Gmail edit access to that file, so Google lets them in. Word and Excel can also be downloaded, edited locally and re-uploaded.
*AC:* Clicking Edit in Google opens an editable Google tab for any approved user with edit rights. A re-uploaded file replaces the old one and keeps its links.

**FR-10: Upload page.** Bulk drag-drop upload, resumable and chunked, sent **directly from the browser to Google** (no bytes through Vercel, no Vercel size limit). Below the drop zone, a list of uploaded files: thumbnail, editable **product title** (defaults to file name), size, Copy link, Copy image link, Delete.
*AC:* Progress bars, auto-resume after a network drop, free space checked first. The product title is saved, searchable and shown as the display name. Delete moves the file to Drive's trash and revokes its links.

**FR-11: Dashboard.** Storage used and total per Drive and combined; recent files.
*AC:* Numbers match Google's quotas within one sync cycle.

**FR-12: Global search.** One search box across every Drive the user can see, against the index (names, product titles, captions, tags).
*AC:* Results in under 500 ms, filterable by type, Drive and favorites.

**FR-13: Captions, tags, favorites.** Per-file caption, tags and favorite flag in Postgres.
*AC:* Editors can change them; all are searchable; a Favorites view exists.

**FR-14: Installable PWA.** Installs on desktop, opens in its own window, works with an offline shell and cached thumbnails.
*AC:* Passes PWA installability; previously viewed thumbnails show offline.

## 6. Non-functional requirements

**Performance**

| Metric | Target |
|---|---|
| Folder open (from index) | < 300 ms |
| Search results | < 500 ms |
| Video start / seek | about 2 s / about 1 s |
| Thumbnails | Only visible tiles fetched; repeats from browser cache |
| Large folders | 5,000 items scroll smoothly (virtualized) |

**Security**
- Server-side authorization on every request: approved user + assigned Drive.
- Refresh tokens encrypted at rest with AES-256-GCM; keys only in Vercel environment variables.
- Private thumbnails and streams use `private` cache headers; only `/i/*` is publicly cacheable.
- 21-character random slugs, instant revoke, Upstash rate limits on `/s`, `/i`, thumb and stream routes.
- Audit log: approvals, link creation and views, uploads, deletions.

## 7. MVP definition

MVP = FR-1 to FR-12 and FR-14. FR-13 follows right after.

**MVP is done when:** the owner connects at least 3 Drives; a teammate sees only their assigned Drives and browses without per-click Google calls; a Copy link opened by a signed-out visitor accepts an upload; an image link pasted into a product page renders; a 1 GB MP4 seeks smoothly; an Excel file opens in Google Sheets from the portal and saves.

## 8. Out of scope

- Cloudflare and any second hosting provider.
- Native desktop app, drive-letter mounting, local sync.
- OneDrive and Dropbox (a storage-provider layer is kept for later).
- Per-link analytics dashboards.
- Real-time co-editing inside the portal (Google's editors are used instead).
- Native mobile apps (the PWA is responsive).
- Open sign-up: every user always needs owner approval.
