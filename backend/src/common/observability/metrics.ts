const outcomes = [
  "SUCCESS",
  "NO_MATCH",
  "NO_SAFE_MATCH",
  "PROFILE_PENDING_ANALYSIS",
  "ONBOARDING_REQUIRED",
  "FAILED",
];
const ranks = [
  "DETERMINISTIC",
  "AI_RERANKED",
  "FALLBACK_QUOTA",
  "FALLBACK_AI_NOT_CONFIGURED",
  "FALLBACK_AI_UNAVAILABLE",
  "FALLBACK_AI_INVALID_OUTPUT",
  "FALLBACK_AI_QUOTA_EXCEEDED",
  "FALLBACK_AI_BUDGET_EXCEEDED",
];
const counters = new Map<string, number>();
const providerSources = new Set([
  "google",
  "goong",
  "foursquare",
  "geoapify",
  "themealdb",
  "spoonacular",
]);
export function recordProviderResponse(source: string, status: string) {
  if (source === "google-photos") source = "google";
  if (!providerSources.has(source)) return;
  if (!["OK", "UNAVAILABLE", "QUOTA_EXCEEDED", "INVALID_DATA"].includes(status))
    status = "UNAVAILABLE";
  const key = `food_provider_responses_total{source="${source}",status="${status}"}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}
const latencyBuckets = [50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000, Infinity];
const latency = { count: 0, sum: 0, buckets: latencyBuckets.map(() => 0) };
const aiOutcomes = new Set([
  "OK",
  "AI_UNAVAILABLE",
  "AI_INVALID_OUTPUT",
  "AI_QUOTA_EXCEEDED",
  "AI_BUDGET_EXCEEDED",
]);
const aiLatency = { count: 0, sum: 0, buckets: latencyBuckets.map(() => 0) };
export function recordAiCall(status: string, milliseconds: number) {
  if (!aiOutcomes.has(status)) status = "AI_UNAVAILABLE";
  const key = `food_ai_calls_total{outcome="${status}"}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
  aiLatency.count++;
  aiLatency.sum += milliseconds;
  latencyBuckets.forEach((upper, index) => {
    if (milliseconds <= upper) aiLatency.buckets[index]!++;
  });
}
export function recordRanking(status: string) {
  if (!ranks.includes(status)) return;
  const key = `food_recommendation_ranking_total{status="${status}"}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}
export function recordRecommendation(status: string, milliseconds: number) {
  if (!outcomes.includes(status)) status = "FAILED";
  const key = `food_recommendation_requests_total{outcome="${status}"}`;
  counters.set(key, (counters.get(key) ?? 0) + 1);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
  latency.count++;
  latency.sum += milliseconds;
  latencyBuckets.forEach((upper, index) => {
    if (milliseconds <= upper) latency.buckets[index]!++;
  });
}
export function metricsText() {
  return [
    "# TYPE food_recommendation_requests_total counter",
    "# TYPE food_recommendation_ranking_total counter",
    "# TYPE food_ai_calls_total counter",
    "# TYPE food_provider_responses_total counter",
    ...[...counters.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key} ${value}`),
    "# TYPE food_recommendation_duration_ms histogram",
    ...latencyBuckets.map(
      (upper, index) =>
        `food_recommendation_duration_ms_bucket{le="${Number.isFinite(upper) ? upper : "+Inf"}"} ${latency.buckets[index]}`,
    ),
    `food_recommendation_duration_ms_sum ${latency.sum}`,
    `food_recommendation_duration_ms_count ${latency.count}`,
    "# TYPE food_ai_duration_ms histogram",
    ...latencyBuckets.map(
      (upper, index) =>
        `food_ai_duration_ms_bucket{le="${Number.isFinite(upper) ? upper : "+Inf"}"} ${aiLatency.buckets[index]}`,
    ),
    `food_ai_duration_ms_sum ${aiLatency.sum}`,
    `food_ai_duration_ms_count ${aiLatency.count}`,
    "",
  ].join("\n");
}
