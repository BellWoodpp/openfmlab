ALTER TABLE "voice_clones" ADD COLUMN "language_code" text DEFAULT 'en-US' NOT NULL;
--> statement-breakpoint
ALTER TABLE "voice_clones" ADD COLUMN "model_name" text;
