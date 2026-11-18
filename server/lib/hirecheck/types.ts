// Shared types for the HireCheck research pipeline.

export type CheckId = "license" | "bond" | "insurance" | "complaints" | "legal" | "reviews";

export type FindingStatus =
  | "clear" // evidence says this check is fine
  | "red_flag" // evidence shows a problem
  | "conflicting" // sources disagree
  | "not_found"; // no usable evidence about this business

export type Verdict = "hire" | "caution" | "avoid" | "cant_tell";

export interface HireCheckInput {
  name: string;
  city?: string | undefined;
  state?: string | undefined; // two-letter, defaults to WA
  trade?: string | undefined;
  licenseNumber?: string | undefined;
}

export interface Citation {
  url: string;
  title?: string | undefined;
  quote: string; // exact text found on the page (or the official record field)
  verified: boolean; // quote was found verbatim in the fetched text
  kind: "official_record" | "web_page";
}

export interface Finding {
  check: CheckId;
  label: string;
  status: FindingStatus;
  summary: string;
  citations: Citation[];
  struck?: string[] | undefined; // sentences removed by the auditor because the quotes did not support them
}

export interface TraceStep {
  step: string;
  detail: string;
  ms: number;
}

export interface MatchedBusiness {
  businessName: string;
  licenseNumber: string;
  ubi?: string | undefined;
  city?: string | undefined;
  status?: string | undefined;
  sourceUrl: string;
}

export interface HireCheckReport {
  input: HireCheckInput;
  verdict: Verdict;
  verdictReason: string;
  matched?: MatchedBusiness | undefined;
  candidates?: MatchedBusiness[] | undefined; // when the name was ambiguous
  findings: Finding[];
  questionsToAsk: string[];
  trace: TraceStep[];
  models: { reasoning: string; audit: string };
  generatedAt: string;
}
