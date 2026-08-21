import { pgTable, text, timestamp, uuid, integer, jsonb, vector } from "drizzle-orm/pg-core";

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
  // Evidence/citations, agent steps and model used, so historical messages
  // render identically. Never persist chain-of-thought.
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("chat_settings", {
  // userId is both the primary key and foreign key
  // one settings row per user, no more
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  // The system prompt — instructs the AI how to behave
  // null means no system prompt (use model default)
  systemPrompt: text("system_prompt"),

  // Which model the user has selected
  // default to our primary OpenRouter model
  model: text("model")
    .default("meta-llama/llama-3.3-70b-instruct:free")
    .notNull(),

  // Personalization: how detailed the assistant should be.
  answerDepth: text("answer_depth").default("beginner").notNull(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------
// DOC CHUNKS TABLE
// Stores embedded chunks from Liara documentation.
// Each row is one chunk from one markdown file.
// content_hash enables idempotent incremental ingestion.
// embedding_model prevents mixing vector spaces.
// ---------------------------------------------------------
export const docChunks = pgTable("doc_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  service: text("service").notNull(),
  path: text("path").notNull(),
  title: text("title").notNull(),
  sourceUrl: text("source_url").notNull(),
  heading: text("heading"),
  chunkText: text("chunk_text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  contentHash: text("content_hash").notNull(),
  embeddingModel: text("embedding_model").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  metadata: jsonb("metadata"),
  indexedAt: timestamp("indexed_at").defaultNow().notNull(),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type MessageRow = typeof messages.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type DocChunk = typeof docChunks.$inferSelect;
export type NewDocChunk = typeof docChunks.$inferInsert;
