import { object, list, string } from "../discovery/provider.http.js";
import type { AiConfig } from "./ai.config.js";
import { estimatedBudgetMicros } from "./ai.budget.policy.js";
import { recordAiCall } from "../../common/observability/metrics.js";
import { performance } from "node:perf_hooks";

export class AiError extends Error {
  constructor(
    public code:
      | "AI_NOT_CONFIGURED"
      | "AI_UNAVAILABLE"
      | "AI_INVALID_OUTPUT"
      | "AI_QUOTA_EXCEEDED"
      | "AI_BUDGET_EXCEEDED",
  ) {
    super(code);
  }
}
export interface StructuredAiProvider {
  model: string;
  configured: boolean;
  generate(instruction: string, input: unknown, schema: object): Promise<unknown>;
}

// Gemini's structured-output endpoint supports a narrower schema vocabulary than
// the TypeBox JSON Schema used for final server-side validation.
function geminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(geminiSchema);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  if (
    Array.isArray(source.anyOf) &&
    source.anyOf.length > 0 &&
    source.anyOf.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        Object.prototype.hasOwnProperty.call(item, "const"),
    )
  ) {
    const variants = source.anyOf as Array<Record<string, unknown>>;
    return { type: variants[0]?.type ?? "string", enum: variants.map((item) => item.const) };
  }
  const unsupported = new Set(["additionalProperties", "minLength", "maxLength", "maxItems"]);
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !unsupported.has(key))
      .map(([key, item]) => [key, geminiSchema(item)]),
  );
}

// Official REST contract: ai.google.dev/gemini-api/docs/generate-content/structured-output
export function createGeminiProvider(
  config: AiConfig,
  fetcher: typeof fetch = fetch,
  reserveBudget?: (micros: bigint) => Promise<boolean>,
): StructuredAiProvider {
  return {
    model: config.model,
    configured: !!config.apiKey,
    async generate(instruction, input, schema) {
      if (!config.apiKey) throw new AiError("AI_NOT_CONFIGURED");
      const startedAt = performance.now();
      let outcome = "OK";
      try {
        if (new Date().toISOString().slice(0, 10) > config.priceValidUntil)
          throw new AiError("AI_BUDGET_EXCEEDED");
        const requestBody = JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: config.maxTokens,
            thinkingConfig: { thinkingLevel: "LOW" },
            responseFormat: {
              text: { mimeType: "APPLICATION_JSON", schema: geminiSchema(schema) },
            },
          },
        });
        const requestBytes = Buffer.byteLength(requestBody);
        if (requestBytes > config.inputMaxBytes) throw new AiError("AI_INVALID_OUTPUT");
        if (!reserveBudget || !(await reserveBudget(estimatedBudgetMicros(config, requestBytes))))
          throw new AiError("AI_BUDGET_EXCEEDED");
        let response: Response | undefined;
        for (let attempt = 0; attempt < config.maxAttempts; attempt += 1) {
          response = await fetcher(
            `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
            {
              method: "POST",
              redirect: "error",
              signal: AbortSignal.timeout(config.timeoutMs),
              headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
              body: requestBody,
            },
          );
          const retryable = response.status === 429 || response.status >= 500;
          if (!retryable || attempt === config.maxAttempts - 1) break;
          // Keep unit tests fast while giving the live provider a short bounded recovery window.
          if (fetcher === fetch) {
            const retryAfter = Number(response.headers.get("retry-after"));
            const delayMs = Number.isFinite(retryAfter)
              ? Math.min(retryAfter * 1000, 2000)
              : Math.min(250 * 2 ** attempt, 2000);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
        if (!response) throw new AiError("AI_UNAVAILABLE");
        if (response.status === 429) throw new AiError("AI_QUOTA_EXCEEDED");
        if (!response.ok) throw new AiError("AI_UNAVAILABLE");
        const reader = response.body?.getReader();
        if (!reader) throw new AiError("AI_INVALID_OUTPUT");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            size += next.value.length;
            if (size > 100000) throw new AiError("AI_INVALID_OUTPUT");
            chunks.push(next.value);
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
        const body = object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        const candidate = object(list(body.candidates)[0]);
        if (candidate.finishReason !== "STOP") throw new AiError("AI_INVALID_OUTPUT");
        const parts = list(object(candidate.content).parts).filter(
          (p) => object(p).thought !== true,
        );
        return JSON.parse(parts.map((p) => string(object(p).text)).join(""));
      } catch (error) {
        if (error instanceof AiError) {
          outcome = error.code;
          throw error;
        }
        if (error instanceof SyntaxError) {
          outcome = "AI_INVALID_OUTPUT";
          throw new AiError("AI_INVALID_OUTPUT");
        }
        outcome = "AI_UNAVAILABLE";
        throw new AiError("AI_UNAVAILABLE");
      } finally {
        recordAiCall(outcome, performance.now() - startedAt);
      }
    },
  };
}
