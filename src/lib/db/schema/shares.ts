import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const shares = pgTable("shares", {
  id: text("id").primaryKey().notNull(),
  input: text("input").notNull(),
  prompt: text("prompt").notNull(),
  voice: text("voice").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;

