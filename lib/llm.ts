import { type GenerateContentParameters, type GenerateContentResponse, GoogleGenAI, type Part, ThinkingLevel } from "@google/genai";
import * as z from "zod/v4";
import { config } from "./config";

// One place that talks to the AI model: Google Gemini through the official @google/genai SDK.

/** A single Gemini call never waits longer than this; a stalled call fails instead of hanging the app. */
const CALL_TIMEOUT_MS = 30_000;

let client: GoogleGenAI | null = null;
// GEMINI_BASE_URL is only for tests against a local stand-in server.
export const gemini = () =>
  (client ??= new GoogleGenAI({ apiKey: config.ai.apiKey, httpOptions: { timeout: CALL_TIMEOUT_MS, ...(process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : {}) } }));

// Newer Flash models think before answering; a low thinking level keeps replies quick enough for
// a chat. Models that don't accept the setting get the request again without it.
let thinkingSupported = true;

/** generateContent with low thinking where the model supports it. */
export async function generate(params: GenerateContentParameters): Promise<GenerateContentResponse> {
  if (thinkingSupported) {
    try {
      return await gemini().models.generateContent({ ...params, config: { ...params.config, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } });
    } catch (e) {
      if ((e as { status?: number }).status !== 400 || !/think/i.test(String((e as Error).message))) throw e;
      console.warn("Gemini model does not accept a thinking level; sending requests without it.");
      thinkingSupported = false;
    }
  }
  return gemini().models.generateContent(params);
}

/** Ask Gemini for an answer that matches `schema`. Throws if it can't produce one. */
export async function structured<S extends z.ZodType>(schema: S, system: string, parts: Part[]): Promise<z.infer<S>> {
  const res = await generate({
    model: config.ai.model,
    contents: [{ role: "user", parts }],
    config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: geminiSchema(z.toJSONSchema(schema)) },
  });
  if (!res.text) throw new Error(`Gemini returned no answer (finish reason: ${res.candidates?.[0]?.finishReason ?? "unknown"})`);
  return schema.parse(JSON.parse(res.text)) as z.infer<S>;
}

/**
 * Gemini accepts a subset of JSON Schema. Drop what it doesn't need ($schema, defaults) and the
 * "never" branches some generated schemas contain ({"not": {}} inside anyOf).
 */
export function geminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(geminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "$schema" || k === "default") continue;
    if (k === "anyOf" && Array.isArray(v)) {
      const kept = v.filter((s) => !(s && typeof s === "object" && "not" in s && Object.keys(s).length === 1)).map(geminiSchema);
      if (kept.length === 1) Object.assign(out, kept[0]);
      else out.anyOf = kept;
      continue;
    }
    out[k] = geminiSchema(v);
  }
  return out;
}

/** True when Gemini said we're over the usage limit (e.g. the free-tier quota). */
export const isRateLimit = (e: unknown) => {
  const status = (e as { status?: number })?.status;
  return status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(String((e as Error)?.message ?? ""));
};

/** True when a call gave up waiting (our timeout, or the connection was cut). */
export const isTimeout = (e: unknown) => /timed? ?out|abort|ETIMEDOUT|ECONNRESET|socket hang up/i.test(String((e as Error)?.name ?? "") + " " + String((e as Error)?.message ?? ""));
