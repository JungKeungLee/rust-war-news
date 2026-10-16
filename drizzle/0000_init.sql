CREATE TYPE "public"."article_status" AS ENUM('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."breaking_priority" AS ENUM('URGENT', 'NORMAL');--> statement-breakpoint
CREATE TYPE "public"."breaking_status" AS ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."clip_platform" AS ENUM('YOUTUBE', 'SOOP', 'CHZZK', 'TWITCH', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."clip_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('PLANNED', 'READY', 'LIVE', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('OPEN', 'RESOLVED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."incident_type" AS ENUM('BATTLE', 'RAID', 'ALLIANCE', 'BETRAYAL', 'INCIDENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."overlay_mode" AS ENUM('AUTO', 'MANUAL', 'OFF');--> statement-breakpoint
CREATE TYPE "public"."poll_result_visibility" AS ENUM('ALWAYS', 'AFTER_VOTE', 'AFTER_CLOSE');--> statement-breakpoint
CREATE TYPE "public"."poll_status" AS ENUM('DRAFT', 'OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('RECEIVED', 'REVIEWING', 'APPROVED', 'REJECTED', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."role_code" AS ENUM('SUPER_ADMIN', 'EDITOR', 'ANCHOR', 'OPERATOR');--> statement-breakpoint
CREATE TYPE "public"."rundown_kind" AS ENUM('ARTICLE', 'CLIP', 'BREAKING', 'SEGMENT');--> statement-breakpoint
CREATE TYPE "public"."rundown_status" AS ENUM('PENDING', 'ON_AIR', 'DONE', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('UNVERIFIED', 'VERIFYING', 'CONFIRMED', 'DISPUTED', 'FALSE');--> statement-breakpoint
CREATE TABLE "article_clips" (
	"article_id" uuid NOT NULL,
	"clip_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "article_clips_article_id_clip_id_pk" PRIMARY KEY("article_id","clip_id")
);
--> statement-breakpoint
CREATE TABLE "article_revisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"lead" text,
	"body" text NOT NULL,
	"status" "article_status" NOT NULL,
	"note" text,
	"edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"source_breaking_id" uuid,
	"title" text NOT NULL,
	"lead" text,
	"body" text DEFAULT '' NOT NULL,
	"status" "article_status" DEFAULT 'DRAFT' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"cover_url" text,
	"author_id" uuid,
	"published_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"detail" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breaking_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"priority" "breaking_priority" DEFAULT 'NORMAL' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"status" "breaking_status" DEFAULT 'DRAFT' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"show_on_overlay" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"corrected_at" timestamp with time zone,
	"correction_note" text,
	"converted_article_id" uuid,
	"created_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breaking_revisions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"breaking_id" uuid NOT NULL,
	"action" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"note" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"platform" "clip_platform" DEFAULT 'OTHER' NOT NULL,
	"embed_url" text,
	"thumbnail_url" text,
	"team_id" uuid,
	"player_id" uuid,
	"submitter_nickname" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"status" "clip_status" DEFAULT 'PENDING' NOT NULL,
	"is_hot" boolean DEFAULT false NOT NULL,
	"reject_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"submitter_ip_hash" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "flag_status" DEFAULT 'OPEN' NOT NULL,
	"reporter_ip_hash" text,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_anchors" (
	"episode_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "episode_anchors_episode_id_user_id_pk" PRIMARY KEY("episode_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"number" integer,
	"title" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" "episode_status" DEFAULT 'PLANNED' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"live_url" text,
	"replay_url" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"current_item_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"season" text,
	"description" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_teams" (
	"incident_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"side" text,
	CONSTRAINT "incident_teams_incident_id_team_id_pk" PRIMARY KEY("incident_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"title" text NOT NULL,
	"type" "incident_type" DEFAULT 'INCIDENT' NOT NULL,
	"summary" text,
	"occurred_at" timestamp with time zone,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"publish_at" timestamp with time zone,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip_hash" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage" text DEFAULT 'db' NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"width" integer,
	"height" integer,
	"data" "bytea",
	"url" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"uploader_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overlay_states" (
	"key" text PRIMARY KEY NOT NULL,
	"mode" "overlay_mode" DEFAULT 'AUTO' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text NOT NULL,
	"profile" text,
	"stream_url" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"poll_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"poll_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"voter_key" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"question" text NOT NULL,
	"description" text,
	"status" "poll_status" DEFAULT 'DRAFT' NOT NULL,
	"result_visibility" "poll_result_visibility" DEFAULT 'AFTER_VOTE' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_media" (
	"report_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "report_media_report_id_media_id_pk" PRIMARY KEY("report_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "report_teams" (
	"report_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "report_teams_report_id_team_id_pk" PRIMARY KEY("report_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid,
	"type" "incident_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"video_url" text,
	"nickname" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"status" "report_status" DEFAULT 'RECEIVED' NOT NULL,
	"reject_reason" text,
	"is_sensitive" boolean DEFAULT false NOT NULL,
	"public_summary" text,
	"public_after" timestamp with time zone,
	"admin_note" text,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"submitter_ip_hash" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" "role_code" NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rundown_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "rundown_kind" DEFAULT 'SEGMENT' NOT NULL,
	"title" text NOT NULL,
	"article_id" uuid,
	"clip_id" uuid,
	"breaking_id" uuid,
	"anchor_id" uuid,
	"planned_seconds" integer DEFAULT 60 NOT NULL,
	"status" "rundown_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rundown_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rundown_item_id" uuid NOT NULL,
	"anchor_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"csrf_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" text,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"color" text DEFAULT '#64748b' NOT NULL,
	"logo_url" text,
	"description" text,
	"status_label" text,
	"score" integer DEFAULT 0 NOT NULL,
	"is_eliminated" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"color" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_clips" ADD CONSTRAINT "article_clips_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_clips" ADD CONSTRAINT "article_clips_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_revisions" ADD CONSTRAINT "article_revisions_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_breaking_id_breaking_news_id_fk" FOREIGN KEY ("source_breaking_id") REFERENCES "public"."breaking_news"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_converted_article_id_articles_id_fk" FOREIGN KEY ("converted_article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaking_news" ADD CONSTRAINT "breaking_news_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaking_revisions" ADD CONSTRAINT "breaking_revisions_breaking_id_breaking_news_id_fk" FOREIGN KEY ("breaking_id") REFERENCES "public"."breaking_news"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "breaking_revisions" ADD CONSTRAINT "breaking_revisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_anchors" ADD CONSTRAINT "episode_anchors_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_anchors" ADD CONSTRAINT "episode_anchors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_current_item_id_rundown_items_id_fk" FOREIGN KEY ("current_item_id") REFERENCES "public"."rundown_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_teams" ADD CONSTRAINT "incident_teams_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_teams" ADD CONSTRAINT "incident_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overlay_states" ADD CONSTRAINT "overlay_states_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_option_id_poll_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."poll_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_media" ADD CONSTRAINT "report_media_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_media" ADD CONSTRAINT "report_media_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_teams" ADD CONSTRAINT "report_teams_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_teams" ADD CONSTRAINT "report_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_items" ADD CONSTRAINT "rundown_items_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_items" ADD CONSTRAINT "rundown_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_items" ADD CONSTRAINT "rundown_items_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_items" ADD CONSTRAINT "rundown_items_breaking_id_breaking_news_id_fk" FOREIGN KEY ("breaking_id") REFERENCES "public"."breaking_news"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_items" ADD CONSTRAINT "rundown_items_anchor_id_users_id_fk" FOREIGN KEY ("anchor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_scripts" ADD CONSTRAINT "rundown_scripts_rundown_item_id_rundown_items_id_fk" FOREIGN KEY ("rundown_item_id") REFERENCES "public"."rundown_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_scripts" ADD CONSTRAINT "rundown_scripts_anchor_id_users_id_fk" FOREIGN KEY ("anchor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rundown_scripts" ADD CONSTRAINT "rundown_scripts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_clips_clip_idx" ON "article_clips" USING btree ("clip_id");--> statement-breakpoint
CREATE INDEX "article_revisions_article_idx" ON "article_revisions" USING btree ("article_id","version");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_incident_idx" ON "articles" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "articles_featured_idx" ON "articles" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "breaking_status_idx" ON "breaking_news" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "breaking_incident_idx" ON "breaking_news" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "breaking_revisions_breaking_idx" ON "breaking_revisions" USING btree ("breaking_id","created_at");--> statement-breakpoint
CREATE INDEX "clips_status_idx" ON "clips" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "clips_hot_idx" ON "clips" USING btree ("is_hot");--> statement-breakpoint
CREATE INDEX "clips_incident_idx" ON "clips" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "content_flags_status_idx" ON "content_flags" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "episodes_status_idx" ON "episodes" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "events_active_idx" ON "events" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "incident_teams_team_idx" ON "incident_teams" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "incidents_event_idx" ON "incidents" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "incidents_public_idx" ON "incidents" USING btree ("is_public","publish_at");--> statement-breakpoint
CREATE INDEX "incidents_occurred_idx" ON "incidents" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "media_sha_idx" ON "media_files" USING btree ("sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "players_nickname_uq" ON "players" USING btree ("nickname");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_options_position_uq" ON "poll_options" USING btree ("poll_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_voter_uq" ON "poll_votes" USING btree ("poll_id","voter_key");--> statement-breakpoint
CREATE INDEX "poll_votes_option_idx" ON "poll_votes" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "poll_votes_ip_idx" ON "poll_votes" USING btree ("poll_id","ip_hash");--> statement-breakpoint
CREATE INDEX "polls_status_idx" ON "polls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_media_media_idx" ON "report_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_incident_idx" ON "reports" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "reports_ip_idx" ON "reports" USING btree ("submitter_ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "rundown_episode_idx" ON "rundown_items" USING btree ("episode_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "rundown_scripts_item_anchor_uq" ON "rundown_scripts" USING btree ("rundown_item_id","anchor_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_player_uq" ON "team_members" USING btree ("team_id","player_id");--> statement-breakpoint
CREATE INDEX "team_members_player_idx" ON "team_members" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_event_name_uq" ON "teams" USING btree ("event_id","name");--> statement-breakpoint
CREATE INDEX "teams_event_idx" ON "teams" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));