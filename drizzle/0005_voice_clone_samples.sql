ALTER TABLE "voice_clones" ALTER COLUMN "provider_voice_id" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_clone_samples" (
  "id" text PRIMARY KEY NOT NULL,
  "clone_id" text NOT NULL,
  "user_id" text NOT NULL,
  "filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "audio" "bytea" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_clone_samples" ADD CONSTRAINT "voice_clone_samples_clone_id_voice_clones_id_fk" FOREIGN KEY ("clone_id") REFERENCES "public"."voice_clones"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "voice_clone_samples" ADD CONSTRAINT "voice_clone_samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

