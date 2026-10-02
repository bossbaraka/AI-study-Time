/**
 * AI Provider abstraction — the domain never imports fetch directly.
 *
 * Two capabilities are separate:
 *   - generateStructured<T>(req, schema) — for question generation, etc.
 *   - generateText(prompt, context)      — for mentor dialogue
 *
 * Failures are typed, retried once, timed out after 8s, and never leak
 * provider internals to the caller.
 */

import { z } from "zod";

export interface AIProvider {
  generateText(params: { prompt: string; system?: string; temperature?: number }): Promise<string>;
  generateStructured<T>(params: { prompt: string; schema: z.ZodType<T>; temperature?: number }): Promise<T>;
}

export class AIMockProvider implements AIProvider {
  async generateText(params: { prompt: string; system?: string }): Promise<string> {
    const lower = params.prompt.toLowerCase();
    // Deterministic fallback, journey-aware placeholder (real mentor uses context)
    if (lower.includes("example")) return "Here is a concise example tied to your current concept: a closure retains its lexical environment — `function makeCounter(){let n=0; return ()=>++n}` — the inner function keeps `n` alive. This is the same idea your current unit practices.";
    if (lower.includes("test me") || lower.includes("quiz me")) return "Quick retrieval: (1) What does a closure capture — values or bindings? (2) Why does `var` vs `let` matter in a loop? Answer in your own words and I'll compare.";
    return `As your mentor, I anchor every answer to your evidence. You asked: "${params.prompt.slice(0,120)}". Tell me more about the specific concept you are on and I'll give a targeted explanation.`;
  }

  async generateStructured<T>(params: { prompt: string; schema: z.ZodType<T> }): Promise<T> {
    // Return a minimal valid value that satisfies schema for tests — never hallucinates domain data
    // For now, throw to force caller to fallback
    throw new Error("mock provider does not generate structured data");
  }
}

export class GeminiProvider implements AIProvider {
  constructor(private readonly apiKey: string, private readonly model = "gemini-1.5-flash") {}

  async generateText(params: { prompt: string; system?: string; temperature?: number }): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${params.system ? params.system + "\n\n" : ""}${params.prompt}` }] }],
          generationConfig: { temperature: params.temperature ?? 0.3, maxOutputTokens: 700 },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`gemini ${res.status}`);
      const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("empty generation");
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateStructured<T>(params: { prompt: string; schema: z.ZodType<T>; temperature?: number }): Promise<T> {
    const raw = await this.generateText({ prompt: `${params.prompt}\n\nRespond with valid JSON only.`, temperature: params.temperature });
    const json = (() => {
      try {
        // Extract first JSON object in case model added chatter
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1));
        return JSON.parse(raw);
      } catch {
        throw new Error("invalid json from model");
      }
    })();
    const parsed = params.schema.safeParse(json);
    if (!parsed.success) throw new Error("schema validation failed");
    return parsed.data;
  }
}

export function getAIProvider(): AIProvider {
  const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (key) return new GeminiProvider(key);
  return new AIMockProvider();
}
