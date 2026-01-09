CREATE TABLE "tts_monthly_usage" (
	"month" text NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"billing_tier" text NOT NULL,
	"chars" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tts_monthly_usage_pk" PRIMARY KEY("month","provider","billing_tier")
);
