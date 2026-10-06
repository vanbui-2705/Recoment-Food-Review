export function loadAiConfig(env = process.env) {
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const n = Number(env[name]?.trim() || fallback);
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Invalid ${name}`);
    return n;
  };
  const provider = env.LLM_PROVIDER?.trim() || "gemini";
  if (provider !== "gemini") throw new Error("Unsupported LLM_PROVIDER");
  const model = env.LLM_MODEL?.trim() || "gemini-3.8-flash";
  if (!/^gemini-[a-zA-Z0-9.-]{1,80}$/.test(model)) throw new Error("Invalid LLM_MODEL");
  const timeoutMs = integer("LLM_TIMEOUT_MS", 20000, 1000, 60000);
  const leaseSeconds = integer("JOB_LEASE_SECONDS", 90, 30, 600);
  if (leaseSeconds * 1000 < timeoutMs + 10000) throw new Error("JOB_LEASE_SECONDS too short");
  const workerFlag = env.WORKER_ENABLED?.trim() || "false";
  if (!["true", "false"].includes(workerFlag)) throw new Error("Invalid WORKER_ENABLED");
  const decimal = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(env[name]?.trim() || fallback);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      !Number.isSafeInteger(Math.round(value * 1000000))
    )
      throw new Error(`Invalid ${name}`);
    return value;
  };
  const apiKey = env.LLM_API_KEY?.trim() || "";
  // Cost bounds are verified for this text-only model and Standard service tier.
  if (apiKey && model !== "gemini-3.8-flash")
    throw new Error("LLM_MODEL requires a verified budget contract");
  const priceValidUntil = env.LLM_PRICING_VALID_UNTIL?.trim() || "2027-01-01";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(priceValidUntil) ||
    !Number.isFinite(Date.parse(priceValidUntil)) ||
    new Date(priceValidUntil).toISOString().slice(0, 10) !== priceValidUntil
  )
    throw new Error("Invalid LLM_PRICING_VALID_UNTIL");
  return {
    provider,
    apiKey,
    model,
    timeoutMs,
    maxTokens: integer("LLM_MAX_TOKENS", 4096, 512, 16384),
    dailyRequests: integer("LLM_DAILY_REQUEST_LIMIT", 200, 1, 100000),
    dailyBudgetMicros: Math.round(decimal("LLM_DAILY_BUDGET_USD", 10, 0.01, 10000) * 1000000),
    inputUsdPerMillion: decimal("LLM_INPUT_USD_PER_MILLION", 1.5, 1.5, 1000),
    outputUsdPerMillion: decimal("LLM_OUTPUT_USD_PER_MILLION", 7.5, 7.5, 1000),
    inputMaxBytes: integer("LLM_INPUT_MAX_BYTES", 65536, 4096, 131072),
    // Reserve both visible output and a full model-sized reasoning envelope.
    outputBudgetTokens: 131072,
    priceValidUntil,
    maxAttempts: integer("JOB_MAX_ATTEMPTS", 3, 1, 5),
    leaseSeconds,
    workerEnabled: workerFlag === "true",
  };
}
export type AiConfig = ReturnType<typeof loadAiConfig>;
