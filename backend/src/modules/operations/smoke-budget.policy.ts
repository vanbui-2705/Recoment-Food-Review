import { AiError } from "../ai/ai.provider.js";

export function smokeBudget(
  maximum: bigint,
  reserveRequest: () => Promise<boolean>,
  reserveSharedBudget: (micros: bigint) => Promise<boolean>,
) {
  if (maximum < 10000n || maximum > 10000000n) throw new Error("Invalid smoke budget");
  let reserved = 0n;
  let running = false;
  return {
    reserved: () => reserved,
    async reserve(micros: bigint) {
      if (running || micros <= 0n || reserved + micros > maximum) return false;
      running = true;
      try {
        if (!(await reserveRequest())) throw new AiError("AI_QUOTA_EXCEEDED");
        if (!(await reserveSharedBudget(micros))) return false;
        reserved += micros;
        return true;
      } finally {
        running = false;
      }
    },
  };
}
