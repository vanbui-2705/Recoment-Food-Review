import { expect, it } from "vitest";
import {
  metricsText,
  recordRanking,
  recordRecommendation,
  recordAiCall,
  recordProviderResponse,
} from "../../src/common/observability/metrics.js";
it("records bounded aggregate labels and excludes arbitrary sensitive labels", () => {
  recordRanking("FALLBACK_AI_INVALID_OUTPUT");
  recordRanking("private-api-key");
  recordRecommendation("SUCCESS", 120);
  recordRecommendation("private-health-description", 240);
  recordAiCall("AI_BUDGET_EXCEEDED", 20);
  recordAiCall("private-api-key", 30);
  recordProviderResponse("google", "INVALID_DATA");
  recordProviderResponse("private-provider-key", "OK");
  const text = metricsText();
  expect(text).toContain('food_recommendation_ranking_total{status="FALLBACK_AI_INVALID_OUTPUT"}');
  expect(text).toContain('food_recommendation_requests_total{outcome="FAILED"}');
  expect(text).toContain('food_recommendation_duration_ms_bucket{le="+Inf"}');
  expect(text).not.toContain("private-");
  expect(text).toContain('food_ai_calls_total{outcome="AI_BUDGET_EXCEEDED"}');
  expect(text).toContain('food_ai_duration_ms_bucket{le="+Inf"}');
  expect(text).toContain('food_provider_responses_total{source="google",status="INVALID_DATA"}');
});
