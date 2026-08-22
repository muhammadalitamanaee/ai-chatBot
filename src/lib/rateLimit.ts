import { db } from "../db";
import { rateLimits } from "../db/schema";
import { sql } from "drizzle-orm";

// Fixed-minute window per user. No new service — reuses Neon.
// A fresh window_key every minute resets the counter automatically.

const MINUTE_MS = 60_000;
const DEFAULT_LIMIT = 30; // requests per user per minute
// Opportunistically prune rows older than 10 minutes so the table stays tiny.
const WINDOWS_TO_KEEP = 10;
const PRUNE_EVERY = 20; // prune at most ~1x per bucket of requests

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSec: number; // 0 when allowed
}

export async function checkRateLimit(
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / MINUTE_MS);
  const windowKey = `${userId}:${bucket}`;

  // Atomic increment (insert-or-bump). Returns the running count for the window.
  const rows = await db
    .insert(rateLimits)
    .values({ windowKey, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.windowKey,
      set: { count: sql`${rateLimits.count} + 1`, updatedAt: sql`now()` },
    })
    .returning({ count: rateLimits.count });

  const count = rows[0]?.count ?? 1;

  // Occasional cleanup of stale windows (keeps the table bounded).
  if (bucket % PRUNE_EVERY === 0) {
    const cutover = bucket - WINDOWS_TO_KEEP;
    await db
      .delete(rateLimits)
      .where(sql`substring(${rateLimits.windowKey} from ':\\d+$')::bigint < ${cutover}`);
  }

  const allowed = count <= limit;
  const secondsLeftInMinute = Math.ceil(
    (bucket * MINUTE_MS + MINUTE_MS - Date.now()) / 1000,
  );

  return {
    allowed,
    count,
    limit,
    retryAfterSec: allowed ? 0 : Math.max(secondsLeftInMinute, 1),
  };
}
