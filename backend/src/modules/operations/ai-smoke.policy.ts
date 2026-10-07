import { performance } from "node:perf_hooks";
import { AiError, type StructuredAiProvider } from "../ai/ai.provider.js";
import {
  AnalysisResultSchema,
  TASTE_ANALYSIS_INSTRUCTION,
  validateAnalysis,
} from "../taste-analysis/taste-analysis.schema.js";
import {
  RerankSchema,
  RERANK_INSTRUCTION,
  validateRerank,
} from "../recommendations/recommendation.policy.js";
import { CHAT_INSTRUCTION, ChatPlanSchema, validateChatPlan } from "../chat/chat.policy.js";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const description = "Tôi dị ứng đậu phộng. Ngân sách tối đa 50000 đồng.";
const catalogs = {
  allergens: [{ id: id(1), code: "PEANUT", name: "Đậu phộng" }],
  diets: [],
  cuisines: [],
};
const candidates = [
  { id: id(2), dishId: id(3), restaurantId: id(4), score: 90, reasons: ["BUDGET_MATCH"] },
  { id: id(5), dishId: id(6), restaurantId: id(7), score: 80, reasons: ["NEARBY"] },
];
const requireOutput = (ok: boolean) => {
  if (!ok) throw new AiError("AI_INVALID_OUTPUT");
};

// Synthetic inputs with the production prompts and validators. No user/profile/tool writes.
export async function aiContractSmoke(provider: StructuredAiProvider) {
  if (!provider.configured) throw new AiError("AI_NOT_CONFIGURED");
  const cases = [
    {
      code: "ANALYSIS_EXPLICIT_ALLERGY",
      run: async () => {
        const output = validateAnalysis(
          await provider.generate(
            TASTE_ANALYSIS_INSTRUCTION,
            { description, catalogs },
            AnalysisResultSchema,
          ),
          description,
          catalogs,
        );
        requireOutput(
          output.allergies.some((fact) => fact.code === "PEANUT") &&
            output.fields.some((fact) => fact.field === "budgetMax" && fact.value === "50000"),
        );
      },
    },
    {
      code: "RERANK_GROUNDED_IDS",
      run: async () => {
        validateRerank(
          await provider.generate(
            RERANK_INSTRUCTION,
            candidates.map((candidate) => ({
              id: candidate.id,
              score: candidate.score,
              allowedReasonCodes: candidate.reasons,
            })),
            RerankSchema,
          ),
          candidates,
        );
      },
    },
    ...[
      {
        code: "CHAT_MISSING_LOCATION",
        messages: [{ role: "USER", content: "Gợi ý món ăn quanh tôi" }],
        context: { budget: 50000, radius: 3500 },
        check: (plan: ReturnType<typeof validateChatPlan>) => plan.reply === "ASK_LOCATION",
      },
      {
        code: "CHAT_TRANSACTION_COMING_SOON",
        messages: [{ role: "USER", content: "Đặt món rồi thanh toán giúp tôi" }],
        context: {},
        check: (plan: ReturnType<typeof validateChatPlan>) => plan.reply === "COMING_SOON",
      },
      {
        code: "CHAT_MULTI_TURN_RECIPE",
        messages: [
          { role: "USER", content: "Tôi muốn nấu phở" },
          { role: "ASSISTANT", content: "Bạn muốn xem công thức phở?" },
          { role: "USER", content: "Đúng rồi, tìm công thức món đó" },
        ],
        context: {},
        check: (plan: ReturnType<typeof validateChatPlan>) =>
          plan.reply === "RESULTS" &&
          plan.tools.some((tool) => tool.name === "RECIPES" && /ph[oở]/i.test(tool.args.query)),
      },
    ].map((item) => ({
      code: item.code,
      run: async () => {
        const plan = validateChatPlan(
          await provider.generate(
            CHAT_INSTRUCTION,
            { messages: item.messages, context: item.context },
            ChatPlanSchema,
          ),
        );
        requireOutput(item.check(plan));
      },
    })),
  ];
  const results: Array<{ code: string; status: string; latencyMs: number; errorCode?: string }> =
    [];
  for (const item of cases) {
    const start = performance.now();
    try {
      await item.run();
      results.push({
        code: item.code,
        status: "PASS",
        latencyMs: Math.round(performance.now() - start),
      });
    } catch (error) {
      const code = error instanceof AiError ? error.code : "AI_INVALID_OUTPUT";
      results.push({
        code: item.code,
        status: "FAIL",
        latencyMs: Math.round(performance.now() - start),
        errorCode: code,
      });
      // Preserve quota/budget and stop after the first failed live call. Never retry implicitly.
      break;
    }
  }
  return {
    expectedCases: cases.length,
    passed: results.length === cases.length && results.every((r) => r.status === "PASS"),
    results,
  };
}
