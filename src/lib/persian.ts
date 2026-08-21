// ---------------------------------------------------------
// Persian normalization shared by ingestion and retrieval.
// Arabic ي/ك → Persian ی/ک, collapse whitespace/ZWNJ, NFC.
// Used for keyword/semantic consistency; original text kept
// for display/citation.
// ---------------------------------------------------------
export function normalizePersian(text: string): string {
  return text
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .trim();
}
