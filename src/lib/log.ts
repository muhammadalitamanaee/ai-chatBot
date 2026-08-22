// Minimal structured logging — one JSON line per event.
// Deliberately dependency-free (no pino) to keep the server lean on memory.
// Security: never pass API keys, full user prompts, or full retrieved text
// into `fields` — only short labels, counts, ids, and numeric metrics.

interface SafeFields {
  [key: string]: unknown;
}

export function logEvent(event: string, fields: SafeFields = {}): void {
  // Redact anything that looks like a key/secret defensively.
  const redacted: SafeFields = {};
  for (const [k, v] of Object.entries(fields)) {
    redacted[k] =
      typeof v === "string" &&
      (/key|secret|token|password|authorization/i.test(k) ||
        /^(sk-|gsk_|aa-|ghp_|AIza)/.test(v))
        ? "[redacted]"
        : v;
  }
  const line = JSON.stringify({
    t: new Date().toISOString(),
    event,
    ...redacted,
  });
  console.log(line); // structured log line (single JSON string)
}
