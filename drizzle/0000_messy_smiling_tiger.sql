CREATE TYPE "public"."link_kind" AS ENUM('edit', 'view', 'image');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('viewer', 'editor', 'admin', 'owner');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'suspended');--> statement-breakpoint
CREATE TABLE "annotations" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"caption" text,
	"description" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid,
	"link_slug" text,
	"action" text NOT NULL,
	"target" text,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "drive_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"root_folder_id" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"quota_used" bigint DEFAULT 0 NOT NULL,
	"quota_total" bigint,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drive_account_id" uuid NOT NULL,
	"provider_file_id" text NOT NULL,
	"parent_provider_id" text,
	"name" text NOT NULL,
	"title" text,
	"mime_type" text NOT NULL,
	"is_folder" boolean DEFAULT false NOT NULL,
	"size" bigint DEFAULT 0 NOT NULL,
	"has_thumbnail" boolean DEFAULT false NOT NULL,
	"web_view_link" text,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"modified_at" timestamp with time zone,
	"version" text,
	"trashed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "link_kind" NOT NULL,
	"file_id" uuid NOT NULL,
	"created_by" uuid,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"drive_account_id" uuid PRIMARY KEY NOT NULL,
	"page_token" text,
	"scan_page_token" text,
	"status" text DEFAULT 'initial' NOT NULL,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_drive_access" (
	"user_id" uuid NOT NULL,
	"drive_account_id" uuid NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_drive_access_user_id_drive_account_id_pk" PRIMARY KEY("user_id","drive_account_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_accounts" ADD CONSTRAINT "drive_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_drive_account_id_drive_accounts_id_fk" FOREIGN KEY ("drive_account_id") REFERENCES "public"."drive_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_state" ADD CONSTRAINT "sync_state_drive_account_id_drive_accounts_id_fk" FOREIGN KEY ("drive_account_id") REFERENCES "public"."drive_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drive_access" ADD CONSTRAINT "user_drive_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drive_access" ADD CONSTRAINT "user_drive_access_drive_account_id_drive_accounts_id_fk" FOREIGN KEY ("drive_account_id") REFERENCES "public"."drive_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_index" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_action_index" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "drive_accounts_google_sub_index" ON "drive_accounts" USING btree ("google_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "files_drive_account_id_provider_file_id_index" ON "files" USING btree ("drive_account_id","provider_file_id");--> statement-breakpoint
CREATE INDEX "files_drive_account_id_parent_provider_id_trashed_index" ON "files" USING btree ("drive_account_id","parent_provider_id","trashed");--> statement-breakpoint
CREATE INDEX "files_modified_at_index" ON "files" USING btree ("modified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "links_slug_index" ON "links" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "links_file_id_kind_index" ON "links" USING btree ("file_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_sub_index" ON "users" USING btree ("google_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_index" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_status_index" ON "users" USING btree ("status");