// Washington State L&I contractor records, read from the state's open-data portal (data.wa.gov).
// These are the official license, bond, and insurance filings, so they anchor the report.

const SODA = "https://data.wa.gov/resource";
export const DATASETS = {
  license: "m8qx-ubtq", // L&I Contractor License Data - General
  bond: "bzff-4fmt", // L&I Contractor License Data - Bond
  insurance: "ciwg-agsx", // L&I Contractor License Data - Insurance
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export function sodaUrl(dataset: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `${SODA}/${dataset}.json?${qs}`;
}

async function query(dataset: string, params: Record<string, string>): Promise<{ url: string; rows: Row[] }> {
  const url = sodaUrl(dataset, params);
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`data.wa.gov ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { url, rows: (await res.json()) as Row[] };
}

const STOP = new Set(["LLC", "INC", "CO", "CORP", "COMPANY", "THE", "AND", "OF", "SERVICES", "SERVICE", "L.L.C."]);

export function nameTokens(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9& ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Upper-case name without punctuation noise or a trailing LLC/INC, e.g. "B & J Roofing, Inc." -> "B & J ROOFING". */
export function coreName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(/\b(LLC|L L C|INC|CORP|CORPORATION|CO|COMPANY|LTD)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Letters and digits only, for comparing two names. */
export const compactName = (name: string) => coreName(name).replace(/[^A-Z0-9]/g, "");

const esc = (s: string) => s.replace(/'/g, "''");

/** Find license rows by license number, or by business name (and city when given). */
export async function findLicenses(input: {
  name: string;
  city?: string | undefined;
  licenseNumber?: string | undefined;
}): Promise<{ url: string; rows: Row[] }> {
  if (input.licenseNumber) {
    return query(DATASETS.license, {
      $where: `upper(contractorlicensenumber)='${esc(input.licenseNumber.toUpperCase().trim())}'`,
      $limit: "5",
    });
  }
  // 1) the whole name as a phrase (minus LLC/INC), 2) every meaningful word
  const phrase = coreName(input.name);
  let result = phrase.length >= 3
    ? await query(DATASETS.license, { $where: `upper(businessname) like '%${esc(phrase)}%'`, $limit: "25", $order: "licenseexpirationdate DESC" })
    : { url: "", rows: [] as Row[] };
  if (result.rows.length === 0) {
    const tokens = nameTokens(input.name).slice(0, 4);
    if (tokens.length === 0) return result;
    const where = tokens.map((t) => `upper(businessname) like '%${esc(t)}%'`).join(" AND ");
    result = await query(DATASETS.license, { $where: where, $limit: "25", $order: "licenseexpirationdate DESC" });
  }
  if (input.city && result.rows.length > 1) {
    const inCity = result.rows.filter((r) => (r.city || "").toUpperCase() === input.city!.toUpperCase().trim());
    if (inCity.length > 0) result = { url: result.url, rows: inCity };
  }
  return result;
}

/** All license rows under one UBI (state business id): finds the current license when an old one was replaced. */
export async function findByUbi(ubi: string) {
  return query(DATASETS.license, { $where: `ubi='${esc(ubi)}'`, $limit: "10", $order: "licenseexpirationdate DESC" });
}

export async function findBonds(licenseNumber: string) {
  return query(DATASETS.bond, {
    $where: `contractorlicensenumber='${esc(licenseNumber)}'`,
    $limit: "10",
  });
}

export async function findInsurance(licenseNumber: string) {
  return query(DATASETS.insurance, {
    $where: `contractorlicensenumber='${esc(licenseNumber)}'`,
    $limit: "10",
    $order: "expirationdate DESC",
  });
}

/** A record row rendered as "field: value" lines; quotes from records are taken from this text. */
export function recordText(row: Row, fields: string[]): string {
  return fields
    .filter((f) => row[f] !== undefined && row[f] !== "")
    .map((f) => `${f}: ${row[f]}`)
    .join("; ");
}

export const isoDay = (s?: string) => (s ? s.slice(0, 10) : undefined);
