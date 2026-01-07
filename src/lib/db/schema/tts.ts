import { pgTable, text, timestamp, real, customType } from "drizzle-orm/pg-core";
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

  input: text("input").notNull(),
  voice: text("voice").notNull(),
  tone: text("tone").notNull(),
  speakingRateMode: text("speaking_rate_mode").notNull().default("auto"),
  speakingRate: real("speaking_rate"),
  volumeGainDb: real("volume_gain_db").notNull().default(0),

  format: text("format").notNull().default("mp3"),
  mimeType: text("mime_type").notNull().default("audio/mpeg"),
  audio: pgBytea("audio").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ttsShares = pgTable("tts_shares", {
  id: text("id").primaryKey().notNull(),
  generationId: text("generation_id")
    .notNull()
    .references(() => ttsGenerations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TtsGeneration = typeof ttsGenerations.$inferSelect;
export type NewTtsGeneration = typeof ttsGenerations.$inferInsert;

export type TtsShare = typeof ttsShares.$inferSelect;
export type NewTtsShare = typeof ttsShares.$inferInsert;
