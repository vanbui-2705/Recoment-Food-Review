import process from "node:process";
import console from "node:console";
import { fileURLToPath, URL } from "node:url";
import { readdir } from "node:fs/promises";
import dotenv from "dotenv";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../dist/generated/prisma/client.js";
import { releasePreflight } from "../dist/modules/operations/release.policy.js";
import { aiContractSmoke } from "../dist/modules/operations/ai-smoke.policy.js";
import { menuAdapters } from "../dist/modules/merchant-menu/menu-sync.adapters.js";
import { loadAiConfig } from "../dist/modules/ai/ai.config.js";
import { createGeminiProvider } from "../dist/modules/ai/ai.provider.js";
import { smokeBudget } from "../dist/modules/operations/smoke-budget.policy.js";
import { reserveAiBudget } from "../dist/modules/ai/ai.budget.js";
import { securityNamespace } from "../dist/common/security/shared-quota.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const args = process.argv.slice(2);
const live = args.includes("--live-ai");
const database = live || args.includes("--database");
const capFlag = args.find((arg) => arg.startsWith("--max-reservation-usd="));
const cap = Number(capFlag?.split("=")[1] ?? 5);
if (
  args.some((arg) => !["--live-ai", "--database"].includes(arg) && arg !== capFlag) ||
  args.filter((arg) => arg.startsWith("--max-reservation-usd=")).length > 1 ||
  !Number.isFinite(cap) ||
  cap < 0.01 ||
  cap > 10 ||
  (!live && capFlag)
) {
  console.log(
    JSON.stringify({ status: "INVALID_ARGUMENTS", errorCode: "RELEASE_CHECK_ARGUMENTS" }),
  );
  process.exit(1);
}
const preflight = releasePreflight(
  process.env,
  [...menuAdapters.values()].filter((adapter) => adapter.configured).length,
);
const report = { checkedAt: new Date().toISOString(), preflight };
let pool, prisma;
try {
  const required = ["APP_CONFIG", ...(live ? ["AI_CONFIG"] : [])];
  if (
    required.some(
      (code) => preflight.checks.find((check) => check.code === code)?.status !== "CONFIGURED",
    )
  ) {
    report.status = "NEEDS_VALID_CONFIG";
    process.exitCode = 2;
  } else {
    if (database) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 5000,
        statement_timeout: 3000,
      });
      prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
      const directories = await readdir(new URL("../prisma/migrations/", import.meta.url), {
        withFileTypes: true,
      });
      const expected = directories
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      const applied =
        await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      const unresolved =
        await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
      const appliedNames = new Set(applied.map((row) => row.migration_name));
      const missing = expected.filter((name) => !appliedNames.has(name)).length;
      const unknown = applied.filter((row) => !expected.includes(row.migration_name)).length;
      report.database = {
        status: missing || unknown || unresolved[0].count ? "MIGRATIONS_NOT_READY" : "PASS",
        expected: expected.length,
        missing,
        unknown,
        unresolved: unresolved[0].count,
      };
      if (report.database.status !== "PASS") throw new Error("Migration mismatch");
    }
    if (live) {
      const config = loadAiConfig();
      const namespace = securityNamespace();
      const maximum = BigInt(Math.floor(cap * 1000000));
      const budget = smokeBudget(
        maximum,
        async () => {
          const requests =
            await prisma.$queryRaw`INSERT INTO ai_request_counters(namespace,day,requests) VALUES (${namespace},TO_CHAR(NOW() AT TIME ZONE 'UTC','YYYY-MM-DD'),1) ON CONFLICT(namespace,day) DO UPDATE SET requests=ai_request_counters.requests+1 WHERE ai_request_counters.requests<${config.dailyRequests} RETURNING requests`;
          return requests.length > 0;
        },
        (micros) => reserveAiBudget(prisma, config, micros, namespace),
      );
      const provider = createGeminiProvider(config, undefined, budget.reserve);
      report.aiContract = await aiContractSmoke(provider);
      report.aiContract.reservedUsd = Number(budget.reserved()) / 1000000;
      report.aiContract.maximumReservationUsd = cap;
      report.aiContract.costKind = "CONSERVATIVE_RESERVATION_NOT_PROVIDER_INVOICE";
      report.aiContract.scope = "SYNTHETIC_INPUTS_LIVE_MODEL_PRODUCTION_PROMPTS_AND_VALIDATORS";
      report.status = report.aiContract.passed
        ? "AI_CONTRACT_PASS_NOT_FULL_RELEASE"
        : "AI_CONTRACT_FAIL";
      process.exitCode = report.aiContract.passed ? 0 : 1;
    } else {
      report.status = preflight.status;
      process.exitCode =
        preflight.status === "INVALID_CONFIG" ? 1 : preflight.status === "NEEDS_INPUT" ? 2 : 0;
    }
  }
} catch {
  report.status = "CHECK_FAILED";
  report.errorCode = "RELEASE_DEPENDENCY_CHECK_FAILED";
  process.exitCode = 1;
} finally {
  try {
    await prisma?.$disconnect();
    await pool?.end();
  } catch {
    report.status = "CHECK_FAILED";
    report.errorCode = "RELEASE_CLEANUP_FAILED";
    process.exitCode = 1;
  }
  // No provider body, secret, DB URL, profile, model output or recipient is printed.
  console.log(JSON.stringify(report, null, 2));
}
