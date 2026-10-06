import { object, list, string } from "../discovery/provider.http.js";
import type { AiConfig } from "./ai.config.js";

export class AiError extends Error {
  constructor(
    public code: "AI_NOT_CONFIGURED" | "AI_UNAVAILABLE" | "AI_INVALID_OUTPUT" | "AI_QUOTA_EXCEEDED",
  ) {
    super(code);
  }
}
export interface StructuredAiProvider {
  model: string;
  configured: boolean;
  generate(instruction: string, input: unknown, schema: object): Promise<unknown>;
}

// Official REST contract: ai.google.dev/gemini-api/docs/generate-content/structured-output
export function createGeminiProvider(
  config: AiConfig,
  fetcher: typeof fetch = fetch,
): StructuredAiProvider {
  return {
    model: config.model,
    configured: !!config.apiKey,
    async generate(instruction, input, schema) {
      if (!config.apiKey) throw new AiError("AI_NOT_CONFIGURED");
      try {
        const response = await fetcher(
          `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
          {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(config.timeoutMs),
            headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: instruction }] },
              contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
              generationConfig: {
                temperature: 0,
                maxOutputTokens: config.maxTokens,
                responseFormat: { text: { mimeType: "application/json", schema } },
              },
            }),
          },
        );
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
        if (error instanceof AiError) throw error;
        if (error instanceof SyntaxError) throw new AiError("AI_INVALID_OUTPUT");
        throw new AiError("AI_UNAVAILABLE");
      }
    },
  };
}
