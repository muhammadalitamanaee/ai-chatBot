import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ---------------------------------------------------------
// USERS TABLE
// Stores everyone who has logged in via GitHub or Google
// NextAuth creates/updates this automatically on login
// ---------------------------------------------------------
export const users = pgTable("chat_users", {
  // We use the email as the ID — it's unique across providers
  id: text("id").primaryKey(),

  // Display name from GitHub/Google
  name: text("name"),

  // Email from GitHub/Google — how we identify the user
  email: text("email").notNull().unique(),

  // Profile picture URL from GitHub/Google
  image: text("image"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const threads = pgTable("chat_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),

  // Which user owns this thread — foreign key to users table
  // Every thread now belongs to exactly one user
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => threads.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
