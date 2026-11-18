import { callAction, useActionQuery } from "@agent-native/core/client/hooks";
import { IconLoader2, IconShieldCheck } from "@tabler/icons-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function meta() {
  return [{ title: "HireCheck — vet a contractor before you hire" }];
}

const STEPS = [
  "Checking WA L&I license records",
  "Checking bond and insurance filings",
  "Planning searches with Nebius",
  "Searching the web with Tavily",
  "Reading pages",
  "Matching pages to this exact business",
  "Verifying every quote word for word",
  "Fact-checking the findings",
  "Deciding the verdict",
];

export default function CheckIndex() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [trade, setTrade] = useState("");
  const [licenseNumber, setLicense] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recent = useActionQuery("get-report", {} as never);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 5000);
    return () => clearInterval(t);
  }, [busy]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await callAction(
        "check-contractor",
        {
          name: name.trim(),
          city: city.trim() || undefined,
          trade: trade.trim() || undefined,
          licenseNumber: licenseNumber.trim() || undefined,
          state: "WA",
        } as never,
        { timeoutMs: 240_000 },
      )) as { id: string };
      navigate(`/check/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const reports = ((recent.data as { reports?: { id: string; name: string; verdict: string }[] } | undefined)?.reports) ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex items-center gap-3">
        <IconShieldCheck className="size-8 text-primary" />
        <h1 className="text-3xl font-semibold">HireCheck</h1>
      </div>
      <p className="mt-2 text-muted-foreground">
        Before you sign a contractor's quote: official Washington license, bond and insurance records, plus complaints,
        lawsuits and reviews from the live web. Every finding links to an exact, verified quote.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <Input placeholder="Contractor name (e.g. the name on the quote)" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} disabled={busy} />
          <Input placeholder="Trade, e.g. roofing (optional)" value={trade} onChange={(e) => setTrade(e.target.value)} disabled={busy} />
        </div>
        <Input placeholder="WA license number (optional, makes it exact)" value={licenseNumber} onChange={(e) => setLicense(e.target.value)} disabled={busy} />
        <Button type="submit" disabled={busy || name.trim().length < 2} className="w-full">
          {busy ? (
            <span className="flex items-center gap-2">
              <IconLoader2 className="size-4 animate-spin" /> {STEPS[step]}…
            </span>
          ) : (
            "Check this contractor"
          )}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {reports.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-muted-foreground">Recent checks</h2>
          <ul className="mt-2 divide-y divide-border">
            {reports.map((r) => (
              <li key={r.id}>
                <Link to={`/check/${r.id}`} className="flex justify-between py-2 text-sm hover:underline">
                  <span>{r.name}</span>
                  <span className="text-muted-foreground">{r.verdict.replace("_", " ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
