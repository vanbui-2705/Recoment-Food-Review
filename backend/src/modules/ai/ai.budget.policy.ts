import type { AiConfig } from "./ai.config.js";
export function estimatedBudgetMicros(config: AiConfig, requestBytes: number) {
  // Byte upper bound for text tokens plus framing/schema overhead. No attachments/tools/cache.
  if (
    !Number.isSafeInteger(requestBytes) ||
    requestBytes < 0 ||
    requestBytes > config.inputMaxBytes
  )
    throw new Error("AI input outside budget bounds");
  return BigInt(
    Math.ceil(
      (requestBytes + 1024) * config.inputUsdPerMillion +
        config.outputBudgetTokens * config.outputUsdPerMillion,
    ),
  );
}
