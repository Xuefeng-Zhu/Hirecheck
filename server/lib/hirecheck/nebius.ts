// Minimal Nebius Token Factory client (OpenAI-compatible chat completions).
// Used for planning, reading evidence, and auditing. Outputs are JSON.

const BASE_URL = (process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1").replace(/\/$/, "");

export const REASONING_MODEL = process.env.HIRECHECK_MODEL || "deepseek-ai/DeepSeek-V4.1-Flash-1017";
// Used when the main model fails or returns no JSON (e.g. spends its budget thinking).
export const FALLBACK_MODEL = process.env.HIRECHECK_FALLBACK_MODEL || "Qwen/Qwen3-235B-A22B-Instruct-2507";

/** The model that produced the most recent successful answer (shown in the trace). */
export let lastModel = REASONING_MODEL;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function apiKey(): string {
  const key = process.env.NEBIUS_API_KEY;
  if (!key) throw new Error("NEBIUS_API_KEY is not set");
  return key;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error(`Model did not return JSON: ${trimmed.slice(0, 200)}`);
  }
}

/** Ask the model for a JSON object matching `schema`. Retries once with json_object mode. */
export async function chatJSON<T>(
  messages: ChatMessage[],
  schema: Record<string, unknown>,
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<T> {
  const model = opts.model || REASONING_MODEL;
  const body = (responseFormat: unknown, m: string) => ({
    model: m,
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? 16000,
    response_format: responseFormat,
  });

  const strict = { type: "json_schema", json_schema: { name: "output", strict: true, schema } };
  const attempts = [
    { fmt: strict, m: model },
    { fmt: strict, m: FALLBACK_MODEL },
    { fmt: { type: "json_object" }, m: FALLBACK_MODEL },
  ];

  let lastErr: unknown;
  for (const { fmt, m } of attempts) {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
        body: JSON.stringify(body(fmt, m)),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Nebius ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { choices: { message: { content: string }; finish_reason: string }[] };
      const out = extractJson(data.choices[0]?.message?.content ?? "") as T;
      lastModel = m;
      return out;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
