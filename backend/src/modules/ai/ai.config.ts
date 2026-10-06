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
  return {
    provider,
    apiKey: env.LLM_API_KEY?.trim() || "",
    model,
    timeoutMs,
    maxTokens: integer("LLM_MAX_TOKENS", 4096, 512, 16384),
    dailyRequests: integer("LLM_DAILY_REQUEST_LIMIT", 200, 1, 100000),
    maxAttempts: integer("JOB_MAX_ATTEMPTS", 3, 1, 5),
    leaseSeconds,
    workerEnabled: workerFlag === "true",
  };
}
export type AiConfig = ReturnType<typeof loadAiConfig>;
