import { checkRateLimit } from "../src/lib/rateLimit";

async function main() {
  const testUser = `rl-test-${Date.now()}`;
  const lowLimit = 3;
  const results = [];
  const expected = [];
  for (let i = 0; i < 6; i++) {
    const r = await checkRateLimit(testUser, lowLimit);
    results.push(r);
    expected.push({ i, allowed: r.allowed, count: r.count });
  }
  console.log(JSON.stringify(expected, null, 0));
  const blocked = results.filter((r) => !r.allowed);
  const fifthBlocked = results[4]?.allowed === false && results[5]?.allowed === false;
  console.log("blocked after limit?", results.slice(3).every((r) => !r.allowed));
  console.log("count monotonic?", results.every((r, i) => i === 0 || r.count === results[i - 1].count + 1));
  console.log("last invoke → allowed?", fifthBlocked ? "should be blocked" : "ok");
  console.log("retryAfter when blocked > 0?", blocked[0]?.retryAfterSec > 0);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e); process.exit(1); });
