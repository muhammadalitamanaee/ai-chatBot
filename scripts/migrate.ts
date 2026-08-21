import { readFileSync } from "node:fs";
import { join } from "node:path";
// postgresjs (TCP) is used instead of the Neon HTTP driver because DDL
// (DROP/CREATE INDEX) proved unreliable through the HTTP pooler.
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const file = join(process.cwd(), "src", "db", "migrate-vector.sql");

async function main() {
  console.log("[migrate] Reading", file);
  const ddl = readFileSync(file, "utf8");
  const statements = ddl
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }
  console.log(`[migrate] Migration applied (${statements.length} statements).`);

  const count = await sql`SELECT count(*)::int AS n FROM doc_chunks`;
  const indexes = await sql`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'doc_chunks' ORDER BY indexname;
  `;
  console.log("[migrate] doc_chunks rows =", count[0]?.n ?? 0);
  for (const r of indexes) console.log(`  ${r.indexname}`);
}

main().then(() => { sql.end().then(() => process.exit(0)); }).catch((e) => {
  console.error("[migrate] failed:", e);
  sql.end().then(() => process.exit(1));
});
