# HireCheck — Research Agent

> ODSC × Nebius Hackathon submission · Challenge: *Build a research agent that brings its sources*

**One-line pitch:** HireCheck answers the question every homeowner should ask before signing a quote, *"Is this contractor safe to hire?"*, with a verdict where every claim links to an exact, code-verified quote from an official record or a live web page.

- **Demo video (2–3 min):** [docs/hirecheck-demo.mp4](https://github.com/Xuefeng-Zhu/Hirecheck/raw/refs/heads/main/docs/hirecheck-demo.mp4) (2:07; [file page](https://github.com/Xuefeng-Zhu/Hirecheck/blob/main/docs/hirecheck-demo.mp4))
- **Team:** Frank (Xuefeng) Zhu · [@Xuefeng-Zhu](https://github.com/Xuefeng-Zhu) (solo)

## The problem
**User:** a Washington homeowner holding a contractor's quote for a roof, remodel or repair.
**Research task:** decide, in about a minute, whether to sign, and know what to ask first.

In Washington, contractors must be registered with L&I and carry a bond and liability insurance. Homeowners rarely check, and when they do they get scattered results: a license page here, a BBB page for a *different* company with the same name there, a review site with no context. Unlicensed work and contractor scams cost homeowners real money every year, and the remedy (the bond, the insurance) only exists if the contractor actually has it.

HireCheck returns one of four verdicts, **Looks safe to hire / Proceed with caution / Avoid / Can't tell yet**, plus the checks behind it (license, bond, insurance, complaints, lawsuits and penalties, reviews) and the questions to ask before signing.

## How it works
```
question → plan queries → Tavily search → select & dedupe evidence → Nebius Token Factory synthesis → answer with citations
```
HireCheck's version of that loop, with an official-records step in front and two verification steps behind:

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

- **Query planning:** the official records come first and decide whether research happens at all: no exact-name (or license-number) match means stop with *Can't tell yet*, show the look-alikes, and ask for the license number. Otherwise DeepSeek V4.1 Flash writes 5–7 targeted queries, one per check (BBB, Attorney General, lawsuits and liens, L&I penalties, reviews), domain-restricted where that helps. One planned round, then stop: the checks are fixed, so the agent stops once each one has evidence or is marked *No evidence found*.
- **Evidence handling:** results are deduplicated by URL, the top 8 pages are read in full with Tavily extract, and the model labels each page *same business / different business / unclear* before any finding is written; pages about other businesses are set aside and listed in the trace. Every quote the model cites is checked in code, word for word, against the page text (`server/lib/hirecheck/quotes.ts`); unverified quotes are dropped, and a finding left with none becomes *No evidence found*. A second model family (Qwen3-235B) then strikes summary sentences the quotes don't support.
- **Safety:** page text is wrapped in `<source>` tags and the prompts treat it as evidence only, never as instructions. The verdict is computed by code rules (`decideVerdict` in `server/lib/hirecheck/pipeline.ts`), never by a model, so a page can't talk the agent into "Looks safe". API keys live only in `.env` (git-ignored).
- **Trade-offs:** one check costs about 3 model calls, ~7 Tavily searches and 1 extract, roughly 60–90 s. DeepSeek V4.1 Flash is cheap and long-context for reading; Qwen3-235B is a different family, so its audit is independent; each falls back to the other on failure. The ambiguous-name path stops after the records lookup and spends nothing on the web. Exact-name matching trades some recall (a contractor trading under a different name returns *Can't tell yet*) for never borrowing the wrong company's record.

### Agent actions (form, chat, HTTP and MCP)

| Action | What it does |
|---|---|
| `check-contractor` | Full pipeline above; saves and returns the report |
| `get-report` | Read a saved report (or list recent ones) — used for follow-up questions |
| `lookup-wa-contractor` | Raw WA L&I license / bond / insurance records |
| `web-research` | Tavily search, or verify that a quote appears on a page |

The chat agent (Token Factory model) answers follow-ups like *"is a $15,000 bond enough for a $40k roof?"* from the saved report first, and uses `web-research` to verify any new quote before citing it.

## Required services
| Requirement | How we use it |
|---|---|
| Nebius Token Factory (inference) | Model: `deepseek-ai/DeepSeek-V4.1-Flash-1017` — plans the queries, decides which pages are about the same business, writes findings with exact quotes. Model: `Qwen/Qwen3-235B-A22B-Instruct-2507` — independent fact-check audit, fallback reader, and the chat agent. Called through the OpenAI-compatible endpoint `https://api.tokenfactory.nebius.com/v1` (`server/lib/hirecheck/nebius.ts`). |
| Tavily (real-time web search) | `/search` finds live evidence (BBB, AG, courts, news, reviews); `/extract` returns full page text for the top pages (`server/lib/hirecheck/tavily.ts`). Each page's URL travels with its text into the model prompt; findings must cite that URL plus a verbatim quote, and the URL and quote are shown on every finding in the report. |
| data.wa.gov (no key) | Official WA L&I license, bond and insurance records, cited by their query URL. |

## Setup
Requires Node 22.22+ and pnpm. (The template's Python starter is replaced by a TypeScript app; same keys, same services.)

```bash
git clone https://github.com/Xuefeng-Zhu/Hirecheck
cd Hirecheck
pnpm install
cp .env.example .env   # add NEBIUS_API_KEY and TAVILY_API_KEY — never commit them
pnpm tsx scripts/hirecheck.ts "B & J Roofing" Redmond      # CLI: prints the report
pnpm dev                                                    # web UI: open /check on the printed URL
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

HTTP (every action is also an endpoint and an MCP tool):

```bash
curl -X POST http://localhost:<port>/_agent-native/actions/check-contractor \
  -H 'content-type: application/json' -d '{"name":"B & J Roofing","city":"Redmond"}'
```

## Example
**Question:** Is "B & J Roofing" in Redmond, WA safe to hire?

**Answer (excerpt):** **Looks safe to hire.** License BJROOI\*180NC is active until 2027-05-18 with specialty Roofing [1]. A $15,000 bond with Contractors Bonding & Insurance Co is in force until canceled [2], and a $1,000,000 liability policy with Crum & Forster runs to 2027-06-14 [3]. BBB: "B & J Roofing Inc has no complaints filed with BBB in the last 3 years." [4] Reviews are positive ("We were extremely happy with them and they were wonderful.") with one complaint about missed work days ("They have been unresponsive and have missed scheduled work days.") [5]. No source naming the business reports a lawsuit, lien or penalty. Set aside: a Yelp page for a different roofer and a scam article that never names this business.

**Sources:** [1] [WA L&I license record](https://data.wa.gov/resource/m8qx-ubtq.json?%24where=upper(businessname)%20like%20'%25B%20%26%20J%20ROOFING%25'&%24limit=25&%24order=licenseexpirationdate%20DESC) · [2] [WA L&I bond record](https://data.wa.gov/resource/bzff-4fmt.json?%24where=contractorlicensenumber%3D'BJROOI*180NC'&%24limit=10) · [3] [WA L&I insurance record](https://data.wa.gov/resource/ciwg-agsx.json?%24where=contractorlicensenumber%3D'BJROOI*180NC'&%24limit=10&%24order=expirationdate%20DESC) · [4] [BBB profile](https://www.bbb.org/us/wa/redmond/profile/roofing-contractors/b-j-roofing-inc-1296-7039878) · [5] [Angi reviews](https://www.angi.com/companylist/us/wa/redmond/b-and-j-roofing-inc-reviews-167755.htm?page=2)

Every quote above was verified word for word against its source by code before it reached the report.

## Failure / insufficient-evidence case
**Question:** Is "Pacific Roofing" in Seattle safe to hire? → **Can't tell yet**

No contractor is licensed under exactly that name. The closest record is *Quality Pacific Roofing LLC* (QUALIPR893QG), a different business whose license was suspended. Instead of borrowing that company's record or its reviews, HireCheck stops, shows the look-alike, and asks for the license number from the quote. It spends no web searches on the wrong company. (Demo 0:59–1:20.)

Other handled failures: Tavily or Nebius errors (fallback model, then a visible *No evidence found* finding instead of silent output); pages that can't be extracted (search snippet used, quote verification still applies); model quotes that don't appear on the page (dropped and counted in the trace); empty search results (the check reports *No evidence found*, which never counts toward "Looks safe").

## Judging criteria map
| Criterion | Weight | Where to look |
|---|---|---|
| Sourced and verifiable answers | 30% | Example above (every claim → quote + link, verified in `quotes.ts`); demo 0:34–0:59 |
| Works end to end | 25% | Setup (CLI, web UI, HTTP, chat), live Token Factory + Tavily calls; demo 0:22–0:59, failure case 0:59–1:20 |
| Usefulness | 20% | The problem; verdict + "Ask before you sign" questions; demo 0:07–0:22 |
| Agent design | 15% | How it works (records first, entity matching, verify → audit → code verdict, research trace in every report); demo 1:20–1:46 |
| Use of Token Factory and Tavily | 10% | Required services; demo 1:46–1:59 |

## Limits

Official record lookups cover Washington only; in other states HireCheck reports web evidence but will not say "Looks safe" without a license record. HireCheck is a research aid, not legal advice.

## License
MIT
