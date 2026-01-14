import { bigint, customType, pgTable, primaryKey, real, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

const pgBytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const ttsGenerations = pgTable("tts_generations", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  title: text("title"),
  input: text("input").notNull(),
  voice: text("voice").notNull(),
  tone: text("tone").notNull(),
  speakingRateMode: text("speaking_rate_mode").notNull().default("auto"),
  speakingRate: real("speaking_rate"),
  volumeGainDb: real("volume_gain_db").notNull().default(0),

  format: text("format").notNull().default("mp3"),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  // Prefer storing large audio blobs in object storage (Cloudflare R2). Keep `audio` as a DB fallback.
  audioKey: text("audio_key"),
  audioSize: bigint("audio_size", { mode: "number" }),
  audio: pgBytea("audio"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ttsShares = pgTable("tts_shares", {
  id: text("id").primaryKey().notNull(),
  generationId: text("generation_id")
    .notNull()
    .references(() => ttsGenerations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ttsMonthlyUsage = pgTable(
  "tts_monthly_usage",
  {
    month: text("month").notNull(),
    provider: text("provider").notNull().default("google"),
    billingTier: text("billing_tier").notNull(),
    chars: bigint("chars", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.month, t.provider, t.billingTier] }),
  }),
);

export type TtsGeneration = typeof ttsGenerations.$inferSelect;
export type NewTtsGeneration = typeof ttsGenerations.$inferInsert;

export type TtsShare = typeof ttsShares.$inferSelect;
export type NewTtsShare = typeof ttsShares.$inferInsert;

export type TtsMonthlyUsage = typeof ttsMonthlyUsage.$inferSelect;
