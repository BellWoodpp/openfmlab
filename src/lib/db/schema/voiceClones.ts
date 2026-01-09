import { customType, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

export type VoiceCloneStatus = "creating" | "training" | "ready" | "failed";

const pgBytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const voiceClones = pgTable("voice_clones", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  provider: text("provider").notNull().default("google"),
  providerVoiceId: text("provider_voice_id"),
  languageCode: text("language_code").notNull().default("en-US"),
  modelName: text("model_name"),
  name: text("name").notNull(),
  status: text("status").notNull().default("creating"),
  isDefault: boolean("is_default").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type VoiceClone = typeof voiceClones.$inferSelect;
export type NewVoiceClone = typeof voiceClones.$inferInsert;

export const voiceCloneSamples = pgTable("voice_clone_samples", {
  id: text("id").primaryKey().notNull(),
  cloneId: text("clone_id")
    .notNull()
    .references(() => voiceClones.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  audio: pgBytea("audio").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
