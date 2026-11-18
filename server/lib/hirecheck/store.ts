// Report store: in memory, plus a JSON file so reports survive restarts on a single instance.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { HireCheckReport } from "./types";

const DIR = process.env.HIRECHECK_DATA_DIR || join(process.cwd(), "data", "reports");
const mem = new Map<string, HireCheckReport>();

function ensureDir() {
  try {
    mkdirSync(DIR, { recursive: true });
  } catch {
    /* read-only fs: memory only */
  }
}

export function saveReport(report: HireCheckReport): string {
  const id = randomUUID().slice(0, 8);
  mem.set(id, report);
  ensureDir();
  try {
    writeFileSync(join(DIR, `${id}.json`), JSON.stringify(report));
  } catch {
    /* memory only */
  }
  return id;
}

export function getReport(id: string): HireCheckReport | undefined {
  if (!/^[a-z0-9-]{4,40}$/i.test(id)) return undefined;
  const hit = mem.get(id);
  if (hit) return hit;
  const file = join(DIR, `${id}.json`);
  if (!existsSync(file)) return undefined;
  const r = JSON.parse(readFileSync(file, "utf8")) as HireCheckReport;
  mem.set(id, r);
  return r;
}

export function listReports(limit = 20): { id: string; name: string; verdict: string; generatedAt: string }[] {
  ensureDir();
  let ids: string[] = [];
  try {
    ids = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  } catch {
    ids = [...mem.keys()];
  }
  return ids
    .map((id) => {
      const r = getReport(id);
      return r ? { id, name: r.matched?.businessName || r.input.name, verdict: r.verdict, generatedAt: r.generatedAt } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit);
}
