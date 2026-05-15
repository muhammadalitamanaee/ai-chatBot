import { eq, asc } from "drizzle-orm";
import { db } from "./index";
import { threads, messages } from "./schema";
import type { NewMessage } from "./schema";

// ---------------------------------------------------------
// THREAD QUERIES
// ---------------------------------------------------------

// Create a brand new thread with a title
// Returns the newly created thread object
export async function createThread(title: string) {
  // .insert() adds a new row to the threads table
  // .values() is the data you want to insert
  // .returning() tells Postgres to send back the created row
  // (by default INSERT doesn't return anything)
  const result = await db.insert(threads).values({ title }).returning();

  // returning() always gives back an array, we only inserted one row
  // so we grab the first element
  return result[0];
}

// Get a single thread by its ID
// Returns the thread or undefined if not found
export async function getThread(threadId: string) {
  const result = await db
    .select() // SELECT *
    .from(threads) // FROM threads
    .where(eq(threads.id, threadId)); // WHERE id = threadId

  // Again, select returns an array — we only want the first match
  return result[0];
}

// Get all threads, newest first
export async function getAllThreads() {
  return await db
    .select()
    .from(threads)
    // orderBy sorts the results — desc = newest first
    // we'll add this import at the top in a moment
    .orderBy(threads.updatedAt);
}

// Update a thread's updatedAt timestamp
// We call this every time a new message is added to the thread
export async function touchThread(threadId: string) {
  await db
    .update(threads) // UPDATE threads
    .set({ updatedAt: new Date() }) // SET updated_at = NOW()
    .where(eq(threads.id, threadId)); // WHERE id = threadId
}

// Delete a thread and all its messages (cascade handles the messages)
export async function deleteThread(threadId: string) {
  await db.delete(threads).where(eq(threads.id, threadId));
}

// ---------------------------------------------------------
// MESSAGE QUERIES
// ---------------------------------------------------------

// Save a single message to the database
export async function saveMessage(data: NewMessage) {
  const result = await db.insert(messages).values(data).returning();

  return result[0];
}

// Get all messages for a thread, in the order they were created
// asc = ascending = oldest first (correct chronological order)
export async function getMessagesByThread(threadId: string) {
  return await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.createdAt));
}

// Save multiple messages at once — more efficient than saving one by one
export async function saveMessages(data: NewMessage[]) {
  if (data.length === 0) return [];

  const result = await db.insert(messages).values(data).returning();

  return result;
}
