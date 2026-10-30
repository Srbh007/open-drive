# Open Drive — Design Spec

## 1. Overview

Open Drive is an installable PWA that puts many Google Drive accounts behind one portal that looks and behaves like Windows File Explorer: tree navigation pane, breadcrumb address bar, sortable details view, icon and gallery views, right-click menus and full keyboard control.

**Principles:** *Familiar* (borrow Explorer idioms directly) · *Fast* (keyboard-first, optimistic UI) · *Calm* (neutral surfaces; color only for Drive identity and state) · *Consistent* (one component kit everywhere).

## 2. Design tokens

### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `bg` | `#F7F8FA` | `#14161A` | App canvas |
| `surface` | `#FFFFFF` | `#1C1F24` | Panes, cards, rows |
| `surface-muted` | `#F1F3F5` | `#262A30` | Hover, selected, table head |
| `border` | `#E4E7EB` | `#333941` | Dividers, inputs |
| `text` | `#1A1D21` | `#E9EDF2` | Primary text |
| `text-muted` | `#6B7280` | `#9AA3AF` | Metadata |
| `primary` | `#2563EB` | `#3B82F6` | Actions, focus, selection |
| `success / warning / danger` | `#16A34A / #D97706 / #DC2626` | `#22C55E / #F59E0B / #EF4444` | Badges, alerts, storage thresholds |
| `drive-*` | `#EF4444 #F59E0B #84CC16 #10B981 #06B6D4 #3B82F6 #8B5CF6 #EC4899` | same | Per-Drive identity, assigned in rotation on connect |

### Typography

- **Public Sans** for all UI text.
- **JetBrains Mono** for sizes, dates, URLs and the code viewer.
- Scale: 12 caption · 13 table meta · 14 body · 16 page title · 20 section · 28 dashboard figures. Weights 400 / 500 / 600 / 700. Line height 1.4.

### Spacing, radius, density

4 px grid (4, 8, 12, 16, 24, 32). Radius: 4 rows/inputs · 6 buttons · 8 tiles/cards · 12 modals/drop zone · full for Drive dots and avatars. Rows 36 px, nav items 28 px, inputs 36 px.

## 3. Layout

Grid: **nav 280 px | main 1fr | preview 320 px**, top bar 48 px across. Panes resize and collapse (nav collapses to a 48 px icon rail).

- **Left nav tree:** Dashboard, Upload, Links, Favorites at the top. Then each Drive as a root: colored dot, label, and a 3 px storage bar (warning at 80 %, danger at 95 %). Folders expand lazily. With hundreds of Drives, a filter box sits above the Drive list and the list is virtualized.
- **Top bar:** back / forward / up, breadcrumbs (each crumb opens a menu of sibling folders), search (Ctrl+K command palette), view toggle (Details / Large icons / Gallery), sort menu, Upload button, preview-pane toggle, avatar.
- **Main pane:** the current view.
- **Right preview pane:** the focused file's thumbnail, details (type, size, modified, Drive), and buttons: Open, Copy link, Copy image link (images), Download, Edit in Google (Docs, Sheets, Slides, Word, Excel, PowerPoint).

## 4. Screens

**4.1 Login.** Centered card: logo, "Continue with Google", one line on what access is used.

**4.2 Waiting for approval.** Same card: "Waiting for approval", the email used, checks again every 30 s, sign-out link. No navigation.

**4.3 Dashboard.** Total storage bar with one colored segment per Drive and used / total figures. Per-Drive cards: dot, email, storage bar ("182 GB of 2 TB"), file count, sync status. Recent files row (12 tiles).

**4.4 Explorer.**
- **Details:** columns Name (icon + name), Date modified, Type, Size, Drive (dot + label). Click a header to sort, again to reverse.
- **Large icons:** 112 px tiles with thumbnail or type icon and a one-line name.
- **Gallery:** media only, large preview on top, thumbnail grid below.

**4.5 Viewer modal.** Full-screen overlay. Top bar: file name, Drive dot, Copy link, Download, Edit in Google, Close (Esc). Left / right arrows move through the folder.
- Image: zoom, pan, fit / 100 %.
- Video: native controls, speed, picture-in-picture.
- PDF: pages, zoom, fit width.
- Word: rendered pages (docx-preview).
- Excel: read-only grid, frozen header row, sheet tabs at the bottom, cell reference box, find.
- Code and text: syntax colors, line numbers, wrap toggle.
- Anything else: icon, details, Download.

**4.6 Upload page.**
- Top: full-width drop zone (dashed, 12 px radius): "Drop files here to upload to *Drive › Folder*" with a folder picker beside it. Clicking opens the file picker. Many files at once.
- Below: table of uploads, newest first. Columns: **thumbnail 48 px** · **Product title** (inline input, defaults to the file name without extension, saves on blur) · size · status (progress bar → check, or error + Retry) · **Copy link** · **Copy image link** (images only) · **Delete** (confirm popover).
- A "Copy all image links" button above the table copies every image link, one per line, for pasting into listing spreadsheets.

**4.7 Links.** Table of links: file name, Drive dot, kind badge (Edit / View / Image), created by, created date, expires, views. Row actions: Copy, Revoke. Filters: kind, Drive, search.

**4.8 Team (admin).** Tabs:
- **Pending:** name, email, requested date, Approve / Deny.
- **Members:** avatar, email, role select (Viewer / Editor / Admin; Owner shown, not editable), Suspend.
- **Drive access:** for a selected member, a searchable list of all Drives with two checkboxes each: **Can see** and **Can edit**, plus "Select all" / "Clear".

**4.9 Settings.**
- **Links:** "Copy link gives" segmented control **Edit / View** (default Edit). Edit-link expiry (Never, 7 days, 30 days).
- **Appearance:** theme (System / Light / Dark), density.
- **Drives (admin):** Connect Drive button, list with label, color, storage, status, Reconnect, Disconnect.

## 5. Interactions

- **Copy link:** hovering a row or tile fades in a link icon button (120 ms). On touch, single tap selects and shows it. Click copies and shows the toast **"Link copied"** with the kind ("anyone can edit" or "anyone can view"). Also in the right-click menu and **Ctrl+C**.
- **Context menu on a file:** Open, Preview, Download, Copy link, Copy view-only link, Copy image link (images), Edit in Google, Rename, Move to…, Delete (red), Properties.
- **Context menu on empty space:** New folder, Upload files, Sort by, View.
- **Keyboard:** Enter open · Space preview · F2 rename · Delete trash (undo toast) · Ctrl+C copy link · Ctrl+A select all · Ctrl+K search · arrows move · Backspace up a folder · Esc close · ? shortcut list.
- **Multi-select:** Ctrl+click, Shift+click, drag a box on empty space. A bar appears: *N selected · Copy links · Download · Delete · Clear*.
- **Drag and drop:** files from the desktop onto the main pane show "Drop to upload to *folder*". Dragging items onto a folder moves them (same Drive) or copies them (different Drive).

## 6. States

- **Empty:** icon, "This folder is empty", Upload button.
- **Loading:** skeleton rows / tiles matching the view; never a blank screen.
- **Error:** inline banner with Retry. A Drive needing reconnection shows a grey dot and "Reconnect". A viewer that fails offers Download.

## 7. Mobile and PWA

Bottom tab bar (Home, Files, Upload, Links, Settings). Tree becomes a slide-over drawer; preview pane becomes a bottom sheet. Hover actions become a "…" menu per row. Breadcrumbs collapse to the current folder. Installable; offline shell and last folder cached; uploads resume when the connection returns.

## 8. Components

- **shadcn/ui:** Button, Input, Checkbox, Switch, Select, Tabs, Table, Dialog, Sheet, DropdownMenu, ContextMenu, Command, Sonner, Tooltip, Popover, Progress, Skeleton, Badge, Avatar, Card, ScrollArea, Breadcrumb, ToggleGroup, Resizable, Alert.
- **Tailwind:** tokens as CSS variables mapped to utilities, `dark:` variants.
- **lucide-react icons:** Folder, FolderOpen, File, FileText, FileImage, FileVideo, FileSpreadsheet, FileCode, Link2, Copy, Trash2, Pencil, Search, List, LayoutGrid, GalleryHorizontal, UploadCloud, HardDrive, ChevronRight, MoreHorizontal, Download, ExternalLink, ShieldCheck, Users, Settings, LogOut, RefreshCw, PanelRight, X, Check, AlertCircle, Loader2.

## 9. Accessibility

44 px minimum touch targets; every action reachable by keyboard; `aria-current` on the tree and breadcrumbs; toasts use `role=status`; focus returns to the trigger when a modal closes; icon-only buttons have `aria-label` and a tooltip; Drive colors always appear with a text label.
