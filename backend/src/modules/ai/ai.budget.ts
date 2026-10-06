import type { PrismaClient } from "../../generated/prisma/client.js";
import { securityNamespace } from "../../common/security/shared-quota.js";
import type { AiConfig } from "./ai.config.js";
import { createGeminiProvider } from "./ai.provider.js";

export async function reserveAiBudget(
  prisma: PrismaClient,
  config: AiConfig,
  micros: bigint,
  namespace = securityNamespace(),
) {
  if (micros <= 0n || micros > BigInt(config.dailyBudgetMicros)) return false;
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      const rows = await tx.$queryRaw<Array<{ reserved_micros: bigint }>>`
      INSERT INTO ai_budget_usage(namespace,day,reserved_micros,requests)
      VALUES (${namespace},TO_CHAR(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD'),${micros},1)
      ON CONFLICT(namespace,day) DO UPDATE SET reserved_micros=ai_budget_usage.reserved_micros+EXCLUDED.reserved_micros,requests=ai_budget_usage.requests+1
      WHERE ai_budget_usage.reserved_micros+EXCLUDED.reserved_micros<=${BigInt(config.dailyBudgetMicros)} RETURNING reserved_micros`;
      return rows.length > 0;
    },
    { timeout: 3000, maxWait: 2500 },
  );
}
export function createBudgetedGeminiProvider(
  prisma: PrismaClient,
  config: AiConfig,
  fetcher?: typeof fetch,
) {
  return createGeminiProvider(config, fetcher, (micros) => reserveAiBudget(prisma, config, micros));
}
