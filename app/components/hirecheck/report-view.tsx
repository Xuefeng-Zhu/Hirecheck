import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconExternalLink,
  IconHelpCircle,
  IconQuote,
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

import type { Finding, HireCheckReport, Verdict } from "../../../server/lib/hirecheck/types";

const VERDICT: Record<Verdict, { label: string; tone: string; icon: ReactNode }> = {
  hire: {
    label: "Looks safe to hire",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: <IconCircleCheck className="size-7" />,
  },
  caution: {
    label: "Proceed with caution",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: <IconAlertTriangle className="size-7" />,
  },
  avoid: {
    label: "Avoid",
    tone: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
    icon: <IconCircleX className="size-7" />,
  },
  cant_tell: {
    label: "Can't tell yet",
    tone: "border-slate-400/40 bg-slate-400/10 text-slate-700 dark:text-slate-300",
    icon: <IconHelpCircle className="size-7" />,
  },
};

const STATUS: Record<Finding["status"], { label: string; dot: string }> = {
  clear: { label: "Clear", dot: "bg-emerald-500" },
  red_flag: { label: "Red flag", dot: "bg-red-500" },
  conflicting: { label: "Conflicting", dot: "bg-amber-500" },
  not_found: { label: "No evidence", dot: "bg-slate-400" },
};

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function FindingCard({ f }: { f: Finding }) {
  const s = STATUS[f.status];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{f.label}</h3>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`size-2 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{f.summary}</p>
      {f.citations.length > 0 && (
        <ul className="mt-3 space-y-2">
          {f.citations.map((c, i) => (
            <li key={i} className="rounded-lg bg-muted/60 p-3 text-xs">
              <div className="flex gap-2">
                <IconQuote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono leading-relaxed break-words">{c.quote}</span>
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                {c.kind === "official_record" ? "Official record · " : ""}
                {c.title || host(c.url)} <IconExternalLink className="size-3" />
              </a>
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">✓ quote verified</span>
            </li>
          ))}
        </ul>
      )}
      {f.struck && f.struck.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Removed by fact-check: <span className="line-through">{f.struck.join(" ")}</span>
        </p>
      )}
    </div>
  );
}

export function ReportView({ report }: { report: HireCheckReport }) {
  const v = VERDICT[report.verdict];
  const [showTrace, setShowTrace] = useState(false);
  const title = report.matched?.businessName || report.input.name;
  return (
    <div className="space-y-6">
      <div className={`flex items-start gap-4 rounded-2xl border p-5 ${v.tone}`}>
        {v.icon}
        <div>
          <div className="text-xs uppercase tracking-wide opacity-80">{title}</div>
          <div className="text-2xl font-semibold">{v.label}</div>
          <p className="mt-1 text-sm">{report.verdictReason}</p>
          {report.matched && (
            <p className="mt-2 text-xs opacity-80">
              WA license {report.matched.licenseNumber} · UBI {report.matched.ubi} · {report.matched.city}
            </p>
          )}
        </div>
      </div>

      {report.candidates && report.candidates.length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <h3 className="font-medium">Close matches in WA L&I records</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            None of these is licensed under exactly the name you gave. If one is your contractor, re-run with its license number (it should be on the quote, bid or truck).
          </p>
          <ul className="mt-3 divide-y divide-border text-sm">
            {report.candidates.map((c) => (
              <li key={c.licenseNumber} className="flex justify-between gap-3 py-2">
                <span>{c.businessName}</span>
                <span className="text-muted-foreground">
                  {c.city} · {c.licenseNumber} · {c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {report.findings.map((f) => (
          <FindingCard key={f.check} f={f} />
        ))}
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="font-medium">Ask before you sign</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {report.questionsToAsk.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border p-4">
        <button className="text-sm font-medium" onClick={() => setShowTrace((x) => !x)}>
          {showTrace ? "Hide" : "Show"} research trace ({report.trace.length} steps · Nebius models: {report.models.reasoning}, audit {report.models.audit})
        </button>
        {showTrace && (
          <ol className="mt-3 space-y-2 text-xs">
            {report.trace.map((t, i) => (
              <li key={i} className="grid grid-cols-[9rem_1fr_4rem] gap-2">
                <span className="font-medium">{t.step}</span>
                <span className="break-words text-muted-foreground">{t.detail}</span>
                <span className="text-right tabular-nums text-muted-foreground">{(t.ms / 1000).toFixed(1)}s</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
