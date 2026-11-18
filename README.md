# HireCheck — vet a contractor before you sign

**ODSC × Nebius Hackathon entry.** A research agent that answers one question homeowners ask before every remodel, roof or repair:

> *"Is this contractor safe to hire?"*

You type the name on the quote (plus city, trade, or license number if you have them). HireCheck returns **Looks safe / Proceed with caution / Avoid / Can't tell yet**, and every finding links to an exact quote it checked, word for word, against the source.

Built on **Nebius Token Factory** (open-model reasoning) and **Tavily** (live web search and extraction), inside an **[Agent-Native](https://www.agent-native.com/)** app so the same capabilities power a form, a chat agent, an HTTP API and MCP.

---

## The problem

In Washington, contractors must be registered with L&I and carry a bond and liability insurance. Homeowners rarely check, and when they do they get scattered results: a license page here, a BBB page for a *different* company with the same name there, a review site with no context. Scams and unregistered work cost homeowners real money every year.

**User:** a homeowner holding a contractor's quote. **Task:** decide, in a minute, whether to sign, and know what to ask first.

## How it works

```
 name, city, trade, license#
            │
 1. Official records ── data.wa.gov (WA L&I license, bond, insurance filings)
            │            exact-name match only; old licenses followed to the current one by UBI
            │            no exact match → stop: "Can't tell" + close matches + ask for license #
 2. Plan ────────────── Nebius (DeepSeek V4.1 Flash) writes 5–7 targeted queries
            │            (BBB, Attorney General, lawsuits/liens, L&I penalties, reviews)
 3. Search ──────────── Tavily search, domain-restricted where it helps (bbb.org, yelp.com…)
 4. Read ────────────── Tavily extract → full page text for the top 8 pages
 5. Findings ────────── Nebius decides, per page, "is this the same business?" then writes
            │            per-check status + exact quotes, using only same-business pages
 6. Verify ──────────── code checks every quote word for word against the page text;
            │            unverified quotes are dropped, a finding with none becomes "No evidence"
 7. Audit ───────────── a second model family (Qwen3-235B) strikes sentences the quotes don't support
 8. Verdict ─────────── decided by code rules, never by a model
```

**Verdict rules** (`server/lib/hirecheck/pipeline.ts → decideVerdict`):

| Situation | Verdict |
|---|---|
| No exact WA license match, or only look-alike names | Can't tell (ask for license #) |
| License not active | Avoid |
| Two or more red flags | Avoid |
| One red flag, or sources disagree | Caution |
| License, bond and insurance all current, no red flags | Looks safe |

### Design choices and trade-offs

- **Official records first.** License, bond and insurance come straight from the state's open data, so the most important facts never depend on a model or a search snippet.
- **Entity matching is the core problem.** "Pacific Roofing" and "Quality Pacific Roofing" are different companies. We only accept exact-name matches (or a license number) and ask the model to set aside pages about look-alike businesses; the trace shows what was set aside and why.
- **Source text is data, not instructions.** Page text is wrapped in `<source>` tags and the prompts tell the model to use it only as evidence; the verdict is computed in code, so a page can't talk the agent into "Looks safe".
- **Two models, two jobs.** The reader (DeepSeek V4.1 Flash) is cheap and long-context; the auditor (Qwen3-235B) is a different family, so its check is independent. Either falls back to the other if a call fails.
- **Cost/latency.** One check ≈ 3 model calls + ~7 searches + 1 extract, about 60–90 s. The ambiguous-name path stops after the records lookup and spends nothing on the web.

## Required services

| Service | Role |
|---|---|
| Nebius Token Factory | Query planning, reading evidence and matching businesses (`deepseek-ai/DeepSeek-V4.1-Flash-1017`); fact-check audit and the chat agent (`Qwen/Qwen3-235B-A22B-Instruct-2507`) |
| Tavily | `/search` for live web evidence (domain-restricted where useful), `/extract` for full page text used in quote verification |
| data.wa.gov (Socrata) | Official WA L&I license, bond and insurance records (no key needed) |

## Setup

Requires Node 22.22+ and pnpm.

```bash
git clone https://github.com/Xuefeng-Zhu/hirecheck && cd hirecheck
pnpm install
cp .env.example .env   # then set the keys below
pnpm dev               # then open /check on the URL it prints
```

`.env`:

```
NEBIUS_API_KEY=...                         # Token Factory key (dev.nebius.com/builders)
TAVILY_API_KEY=...
# the chat agent runs on Token Factory through its OpenAI-compatible endpoint
AGENT_ENGINE=ai-sdk:openai
AGENT_MODEL=Qwen/Qwen3-235B-A22B-Instruct-2507
OPENAI_BASE_URL=https://api.tokenfactory.nebius.com/v1
OPENAI_API_KEY=...                         # same value as NEBIUS_API_KEY
AUTH_DISABLED=true                         # local/demo only
```

Command line (no UI):

```bash
pnpm tsx scripts/hirecheck.ts "B & J Roofing" Redmond
```

HTTP (every action is also an endpoint and an MCP tool):

```bash
curl -X POST http://localhost:<port>/_agent-native/actions/check-contractor \
  -H 'content-type: application/json' -d '{"name":"B & J Roofing","city":"Redmond"}'
```

## Agent actions

| Action | What it does |
|---|---|
| `check-contractor` | Full pipeline above; saves and returns the report |
| `get-report` | Read a saved report (or list recent ones) — used for follow-up questions |
| `lookup-wa-contractor` | Raw WA L&I license / bond / insurance records |
| `web-research` | Tavily search, or verify that a quote appears on a page |

The chat agent (Token Factory model) answers follow-ups like *"is a $15,000 bond enough for a $40k roof?"* from the saved report first, and uses `web-research` to verify any new quote before citing it.

## Example

**B & J Roofing, Redmond** → **Looks safe**

- License BJROOI*180NC active until 2027-05-18, specialty Roofing *(official record)*
- $15,000 bond, Contractors Bonding & Insurance Co, good until canceled *(official record)*
- $1,000,000 liability policy, valid until 2027-06-14 *(official record)*
- BBB: "B & J Roofing Inc has no complaints filed with BBB in the last 3 years." *(bbb.org, verified)*
- Set aside: a Yelp page for a different roofer and a scam article that never names this business

## Failure / insufficient-evidence case

**"Pacific Roofing", Seattle** → **Can't tell yet**

No contractor is licensed under exactly that name. The closest record is *Quality Pacific Roofing LLC*, a different business whose license was suspended. Instead of borrowing that company's record (or its reviews), HireCheck stops, shows the look-alike, and asks for the license number from the quote. It spends no web searches on the wrong company.

Other handled failures: Tavily or Nebius errors (fallback model, then a visible "No evidence" finding instead of silent output), pages that can't be extracted (search snippet used, quote verification still applies), model quotes that don't appear on the page (dropped and counted in the trace).

## Judging criteria map

| Criterion | Where to look |
|---|---|
| Sourced & verifiable (30%) | Every finding shows its exact quote + link; quotes verified in code (`quotes.ts`); official records cited by query URL |
| Works end to end (25%) | Live Token Factory + Tavily calls on every check; CLI, UI, HTTP and chat paths; failure case above |
| Usefulness (20%) | One decision for one user; verdict + "Ask before you sign" questions |
| Agent design (15%) | Records-first plan, entity matching, verify → audit → code verdict; research trace in every report |
| Token Factory & Tavily (10%) | Two Token Factory models + chat agent; Tavily search and extract; links survive into the report |

## Limits

Official record lookups cover Washington only; in other states HireCheck reports web evidence but will not say "Looks safe" without a license record. HireCheck is a research aid, not legal advice.

## License

MIT
