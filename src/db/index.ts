import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// neon() creates a connection function using your DATABASE_URL
// This is the actual low-level connection to your Neon Postgres database
const sql = neon(process.env.DATABASE_URL!);

// drizzle() wraps the raw connection with Drizzle's query builder
// Now instead of writing raw SQL you write TypeScript
// { schema } tells Drizzle about your tables so it can type everything
export const db = drizzle(sql, { schema });

// We export db as the single instance used everywhere in the app
// Same singleton pattern as lib/gapgpt.ts — one connection, reused
