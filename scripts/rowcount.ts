import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const r = await sql`
    SELECT count(*)::int n, count(DISTINCT path)::int paths,
           count(DISTINCT service)::int services,
           min(vector_dims(embedding))::int min_d, max(vector_dims(embedding))::int max_d,
           count(DISTINCT embedding_model)::int models
    FROM doc_chunks;
  `;
  console.log(
    `rows=${r[0].n} paths=${r[0].paths} services=${r[0].services} dims=${r[0].min_d}..${r[0].max_d} models=${r[0].models}`,
  );
  const tops = await sql`
    SELECT service, count(*)::int c ORDER BY 1 LIMIT 1 FROM (SELECT service FROM doc_chunks) t GROUP BY 1 ORDER BY 1;
  `.catch(() => null);
  const perService = await sql`
    SELECT service, count(*)::int c FROM doc_chunks GROUP BY service ORDER BY c DESC LIMIT 8;
  `;
  for (const s of perService) console.log(`  ${s.service}: ${s.c}`);
  await sql.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
