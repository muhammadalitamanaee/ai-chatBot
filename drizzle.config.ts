import type { Config } from "drizzle-kit";

// This file tells the Drizzle CLI two things:
// 1. Where your schema file is (so it can read your table definitions)
// 2. How to connect to your database (so it can push the schema)
export default {
  // Path to your schema file — where you define your tables
  schema: "./src/db/schema.ts",

  // Where Drizzle puts generated SQL migration files
  // We won't use migrations on Day 2 (we'll use db:push instead)
  // but it's good practice to set this up now
  out: "./drizzle",

  // The database driver to use — neon uses postgres under the hood
  dialect: "postgresql",

  dbCredentials: {
    // Reads your connection string from .env.local
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
