import { describe, expect, it } from "vitest";
import { releasePreflight } from "../../src/modules/operations/release.policy.js";
import { aiContractSmoke } from "../../src/modules/operations/ai-smoke.policy.js";
import { AiError, type StructuredAiProvider } from "../../src/modules/ai/ai.provider.js";
import { smokeBudget } from "../../src/modules/operations/smoke-budget.policy.js";

const base = { DATABASE_URL: "postgresql://private", WORKER_ENABLED: "false" };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const outputs = [
  {
    fields: [{ field: "budgetMax", value: "50000", evidence: "50000 đồng" }],
    allergies: [{ code: "PEANUT", evidence: "dị ứng đậu phộng" }],
    diets: [],
    cuisines: [],
    dishes: [],
    questions: [],
  },
  {
    items: [
      { id: id(2), reasonCodes: ["BUDGET_MATCH"] },
      { id: id(5), reasonCodes: ["NEARBY"] },
    ],
  },
  { reply: "ASK_LOCATION", tools: [] },
  { reply: "COMING_SOON", tools: [] },
  { reply: "RESULTS", tools: [{ name: "RECIPES", args: { query: "phở" } }] },
];
describe("release checks", () => {
  it("caps reservations before writing shared request counters", async () => {
    let calls = 0;
    const budget = smokeBudget(
      1000000n,
      async () => {
        calls++;
        return true;
      },
      async () => true,
    );
    expect(await budget.reserve(600000n)).toBe(true);
    expect(await budget.reserve(600000n)).toBe(false);
    expect(budget.reserved()).toBe(600000n);
    expect(calls).toBe(1);
  });
  it("cannot bypass shared quota or shared USD budget", async () => {
    let costs = 0;
    const quota = smokeBudget(
      1000000n,
      async () => false,
      async () => {
        costs++;
        return true;
      },
    );
    await expect(quota.reserve(100000n)).rejects.toMatchObject({ code: "AI_QUOTA_EXCEEDED" });
    expect(costs).toBe(0);
    const daily = smokeBudget(
      1000000n,
      async () => true,
      async () => false,
    );
    expect(await daily.reserve(100000n)).toBe(false);
    expect(daily.reserved()).toBe(0n);
  });
  it("rejects concurrent budget attempts instead of overbooking", async () => {
    let finish: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const budget = smokeBudget(
      1000000n,
      async () => {
        await gate;
        return true;
      },
      async () => true,
    );
    const first = budget.reserve(600000n);
    expect(await budget.reserve(600000n)).toBe(false);
    finish!();
    expect(await first).toBe(true);
    expect(budget.reserved()).toBe(600000n);
  });
  it("does not confuse credentials or flags with live verification", () => {
    const result = releasePreflight({
      ...base,
      GOOGLE_PLACES_API_KEY: "private-key",
      MENU_SYNC_WORKER_ENABLED: "true",
    });
    expect(result.status).toBe("NEEDS_INPUT");
    expect(result.liveVerified).toBe(false);
    expect(result.checks.find((c) => c.code === "MENU_ADAPTER")?.status).toBe("MISSING");
    expect(result.checks.find((c) => c.code === "MENU_WORKER_FLAG")?.status).toBe("MISSING");
    expect(JSON.stringify(result)).not.toContain("private-key");
  });
  it("redacts arbitrary invalid configuration and checks email wiring", () => {
    const result = releasePreflight({
      ...base,
      NODE_ENV: "secret-input",
      RESEND_API_KEY: "secret-key",
      EMAIL_FROM: "not-email",
    });
    expect(result.status).toBe("INVALID_CONFIG");
    expect(result.checks.find((c) => c.code === "EMAIL_CONFIG")?.status).toBe("INVALID");
    expect(JSON.stringify(result)).not.toMatch(/secret-input|secret-key|not-email/);
  });
  it("reports complete config as unverified", () => {
    const result = releasePreflight(
      {
        ...base,
        WORKER_ENABLED: "true",
        MENU_SYNC_WORKER_ENABLED: "true",
        GOOGLE_PLACES_API_KEY: "private",
        THEMEALDB_API_KEY: "private",
        LLM_API_KEY: "private",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "private",
        EMAIL_FROM: "app@example.com",
        PUBLIC_APP_URL: "https://example.com",
        EMAIL_ALLOWED_ORIGINS: "https://example.com",
        EMAIL_OUTBOX_ENCRYPTION_KEY: "a".repeat(64),
      },
      1,
    );
    expect(result.status).toBe("CONFIGURED_NOT_LIVE_VERIFIED");
    expect(result.liveVerified).toBe(false);
  });
  it("runs bounded contracts without executing tools or revealing model text", async () => {
    let calls = 0;
    const provider: StructuredAiProvider = {
      model: "test",
      configured: true,
      generate: async () => outputs[calls++],
    };
    const result = await aiContractSmoke(provider);
    expect(result.passed).toBe(true);
    expect(calls).toBe(5);
    expect(JSON.stringify(result)).not.toMatch(/đậu phộng|50000|phở/);
  });
  it("fails invented ranking IDs and stops before additional provider calls", async () => {
    let calls = 0;
    const provider: StructuredAiProvider = {
      model: "test",
      configured: true,
      generate: async () =>
        ++calls === 1 ? outputs[0] : { items: [{ id: id(99), reasonCodes: ["BUDGET_MATCH"] }] },
    };
    const result = await aiContractSmoke(provider);
    expect(result.passed).toBe(false);
    expect(result.results.at(-1)?.errorCode).toBe("AI_INVALID_OUTPUT");
    expect(calls).toBe(2);
  });
  it("stops on quota and never leaks provider error content", async () => {
    const provider: StructuredAiProvider = {
      model: "test",
      configured: true,
      generate: async () => {
        throw new AiError("AI_QUOTA_EXCEEDED");
      },
    };
    const result = await aiContractSmoke(provider);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.errorCode).toBe("AI_QUOTA_EXCEEDED");
    const broken = await aiContractSmoke({
      ...provider,
      generate: async () => {
        throw new Error("private-provider-body");
      },
    });
    expect(JSON.stringify(broken)).not.toContain("private-provider-body");
  });
});
