CREATE TYPE "public"."team_public_status" AS ENUM('UNKNOWN', 'NORMAL', 'INCIDENT', 'ALERT');--> statement-breakpoint
ALTER TYPE "public"."incident_type" ADD VALUE 'DEFENSE';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "public_status" "team_public_status" DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status_message" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status_is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status_incident_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status_updated_by" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "status_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_status_incident_id_incidents_id_fk" FOREIGN KEY ("status_incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_status_updated_by_users_id_fk" FOREIGN KEY ("status_updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;