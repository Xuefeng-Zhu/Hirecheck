// Verbatim quote checking: a model's quote only counts if it appears in the page text.

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[*_#>`|]/g, " ") // markdown noise from extraction
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears in `source` after normalizing whitespace, case, and punctuation styles. */
export function quoteAppearsIn(quote: string, source: string): boolean {
  const q = normalize(quote).replace(/^\.+|\.+$/g, "").replace(/…/g, "...");
  if (q.length < 12) return false; // too short to mean anything
  const s = normalize(source);
  if (s.includes(q)) return true;
  // allow an ellipsis inside the quote: every piece must appear, in order
  const parts = q.split(/\s*\.\.\.\s*/).filter((p) => p.length > 0);
  if (parts.length < 2) return false;
  let from = 0;
  for (const p of parts) {
    const idx = s.indexOf(p, from);
    if (idx < 0) return false;
    from = idx + p.length;
  }
  return true;
}
