import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { quoteAppearsIn } from "../server/lib/hirecheck/quotes";
import { tavilyExtract, tavilySearch } from "../server/lib/hirecheck/tavily";

export default defineAction({
  description:
    "Search the live web with Tavily (optionally limited to domains like bbb.org or yelp.com) and return results with page text. " +
    "If `quote` and `url` are given instead, verify that the quote appears word for word on that page.",
  http: { method: "GET" },
  schema: z.object({
    query: z.string().optional().describe("Search query, e.g. '\"Evergreen Roofing\" Redmond BBB complaints'"),
    domains: z.array(z.string()).optional().describe("Restrict search to these domains, e.g. ['bbb.org']"),
    url: z.string().optional().describe("Page URL to read (or to verify a quote against)"),
    quote: z.string().optional().describe("Exact quote to verify on `url`"),
  }),
  run: async ({ query, domains, url, quote }) => {
    if (url) {
      const [page] = await tavilyExtract([url]);
      const text = page?.raw_content || "";
      return quote ? { url, verified: quoteAppearsIn(quote, text) } : { url, text: text.slice(0, 12000) };
    }
    if (!query) throw new Error("Give a query, or a url");
    const results = await tavilySearch(query, { includeDomains: domains?.length ? domains : undefined, maxResults: 6 });
    return { results: results.map((r) => ({ url: r.url, title: r.title, snippet: r.content })) };
  },
});
