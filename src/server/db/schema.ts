import { pgTable, pgEnum, uuid, text, boolean, integer, bigint, timestamp, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", ["pending", "approved", "suspended"]);
export const userRole = pgEnum("user_role", ["viewer", "editor", "admin", "owner"]);
export const linkKind = pgEnum("link_kind", ["edit", "view", "image"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  image: text("image"),
  status: userStatus("status").notNull().default("pending"),
  role: userRole("role").notNull().default("viewer"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex().on(t.googleSub), uniqueIndex().on(t.email), index().on(t.status)]);

export const driveAccounts = pgTable("drive_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleSub: text("google_sub").notNull(),
  email: text("email").notNull(),
  label: text("label").notNull(),
  color: text("color").notNull(),
  rootFolderId: text("root_folder_id").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  quotaUsed: bigint("quota_used", { mode: "number" }).notNull().default(0),
  quotaTotal: bigint("quota_total", { mode: "number" }),
  status: text("status").notNull().default("active"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex().on(t.googleSub)]);

export const userDriveAccess = pgTable("user_drive_access", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  driveAccountId: uuid("drive_account_id").notNull().references(() => driveAccounts.id, { onDelete: "cascade" }),
  canEdit: boolean("can_edit").notNull().default(false),
}, (t) => [primaryKey({ columns: [t.userId, t.driveAccountId] })]);

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  driveAccountId: uuid("drive_account_id").notNull().references(() => driveAccounts.id, { onDelete: "cascade" }),
  providerFileId: text("provider_file_id").notNull(),
  parentProviderId: text("parent_provider_id"),
  name: text("name").notNull(),
  title: text("title"),
  mimeType: text("mime_type").notNull(),
  isFolder: boolean("is_folder").notNull().default(false),
  size: bigint("size", { mode: "number" }).notNull().default(0),
  hasThumbnail: boolean("has_thumbnail").notNull().default(false),
  webViewLink: text("web_view_link"),
  width: integer("width"), height: integer("height"), durationMs: integer("duration_ms"),
  modifiedAt: timestamp("modified_at", { withTimezone: true }),
  version: text("version"),
  trashed: boolean("trashed").notNull().default(false),
}, (t) => [
  uniqueIndex().on(t.driveAccountId, t.providerFileId),
  index().on(t.driveAccountId, t.parentProviderId, t.trashed),
  index().on(t.modifiedAt),
]);

export const annotations = pgTable("annotations", {
  fileId: uuid("file_id").primaryKey().references(() => files.id, { onDelete: "cascade" }),
  caption: text("caption"),
  description: text("description"),
  tags: text("tags").array().notNull().default([]),
  favorite: boolean("favorite").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const links = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  kind: linkKind("kind").notNull(),
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => users.id),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  views: integer("views").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex().on(t.slug), index().on(t.fileId, t.kind)]);

export const syncState = pgTable("sync_state", {
  driveAccountId: uuid("drive_account_id").primaryKey().references(() => driveAccounts.id, { onDelete: "cascade" }),
  pageToken: text("page_token"),
  scanPageToken: text("scan_page_token"),
  status: text("status").notNull().default("initial"),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  userId: uuid("user_id").references(() => users.id),
  linkSlug: text("link_slug"),
  action: text("action").notNull(),
  target: text("target"),
  ip: text("ip"),
}, (t) => [index().on(t.at), index().on(t.action)]);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
