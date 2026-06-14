import { eq, asc, and } from "drizzle-orm";
import { db } from "./index";
import { threads, messages, users } from "./schema";
import type { NewMessage, NewUser } from "./schema";

// Upsert user on login
export async function upsertUser(data: NewUser) {
  const result = await db
    .insert(users)
    .values(data)
    .onConflictDoUpdate({
      target: users.email,
      set: { name: data.name, image: data.image },
    })
    .returning();
  return result[0];
}

// Create thread — now requires userId
export async function createThread(title: string, userId: string) {
  const result = await db.insert(threads).values({ title, userId }).returning();
  return result[0];
}

// Get only THIS user's threads
export async function getAllThreads(userId: string) {
  return await db
    .select()
    .from(threads)
    .where(eq(threads.userId, userId))
    .orderBy(threads.updatedAt);
}

export async function touchThread(threadId: string) {
  await db
    .update(threads)
    .set({ updatedAt: new Date() })
    .where(eq(threads.id, threadId));
}

export async function deleteThread(threadId: string, userId: string) {
  // and() makes sure users can only delete their OWN threads
  await db
    .delete(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
}

export async function saveMessage(data: NewMessage) {
  const result = await db.insert(messages).values(data).returning();
  return result[0];
}

// Only return messages if the thread belongs to this user
export async function getMessagesByThread(threadId: string, userId: string) {
  // First verify the thread belongs to this user
  const thread = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));

  // If thread doesn't exist or doesn't belong to user — return empty
  if (!thread[0]) return [];

  return await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(asc(messages.createdAt));
}
