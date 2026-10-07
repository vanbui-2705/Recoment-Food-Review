import { loadEnv, trustedProxyIps } from "../../config/env.js";
import { securityNamespace } from "../../common/security/shared-quota.js";
import { loadAiConfig } from "../ai/ai.config.js";
import { loadEmailConfig } from "../email/email.config.js";
import { loadRankingWeights } from "../recommendations/recommendation.policy.js";
import { menuSyncEnabled } from "../merchant-menu/menu-sync.adapters.js";

type Check = { code: string; status: "CONFIGURED" | "MISSING" | "INVALID" };

// Configuration presence is never proof of provider availability or delivery.
export function releasePreflight(env: NodeJS.ProcessEnv, configuredMenuAdapters = 0) {
  const checks: Check[] = [];
  const validated = (code: string, inspect: () => boolean) => {
    try {
      checks.push({ code, status: inspect() ? "CONFIGURED" : "MISSING" });
    } catch {
      // Config exceptions may contain arbitrary operator input; never reflect them.
      checks.push({ code, status: "INVALID" });
    }
  };
  validated("APP_CONFIG", () => {
    loadEnv(env);
    trustedProxyIps(env);
    securityNamespace(env);
    loadRankingWeights(env);
    return true;
  });
  validated("PLACES_SOURCE", () =>
    ["GOOGLE_PLACES_API_KEY", "GOONG_API_KEY", "FOURSQUARE_API_KEY", "GEOAPIFY_API_KEY"].some(
      (key) => !!env[key]?.trim(),
    ),
  );
  validated("RECIPE_SOURCE", () =>
    ["THEMEALDB_API_KEY", "SPOONACULAR_API_KEY"].some((key) => !!env[key]?.trim()),
  );
  validated("AI_CONFIG", () => {
    const config = loadAiConfig(env);
    if (new Date().toISOString().slice(0, 10) > config.priceValidUntil)
      throw new Error("Expired price contract");
    return !!config.apiKey;
  });
  validated("EMAIL_CONFIG", () => loadEmailConfig(env).configured);
  validated("BACKGROUND_WORKER_FLAG", () => loadAiConfig(env).workerEnabled);
  validated("MENU_ADAPTER", () => configuredMenuAdapters > 0);
  validated("MENU_WORKER_FLAG", () => menuSyncEnabled(env));
  return {
    mode: "CONFIGURATION_ONLY" as const,
    liveVerified: false as const,
    status: checks.some((check) => check.status === "INVALID")
      ? "INVALID_CONFIG"
      : checks.some((check) => check.status === "MISSING")
        ? "NEEDS_INPUT"
        : "CONFIGURED_NOT_LIVE_VERIFIED",
    checks,
  };
}
