// Tavily real-time search and page extraction.

const TAVILY = "https://api.tavily.com";

function apiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set");
  return key;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${TAVILY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Tavily ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

export async function tavilySearch(
  query: string,
  opts: { includeDomains?: string[] | undefined; maxResults?: number | undefined; depth?: "basic" | "advanced" | undefined } = {},
): Promise<SearchResult[]> {
  const data = await post<{ results: SearchResult[] }>("/search", {
    query,
    search_depth: opts.depth ?? "advanced",
    max_results: opts.maxResults ?? 5,
    include_domains: opts.includeDomains,
    include_answer: false,
  });
  return data.results ?? [];
}

export interface ExtractedPage {
  url: string;
  raw_content: string;
}

export async function tavilyExtract(urls: string[]): Promise<ExtractedPage[]> {
  if (urls.length === 0) return [];
  const data = await post<{ results: ExtractedPage[] }>("/extract", {
    urls: urls.slice(0, 20),
    extract_depth: "basic",
  });
  return data.results ?? [];
}
