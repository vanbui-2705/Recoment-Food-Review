import type { PrismaClient } from "../../generated/prisma/client.js";
import { reserveQuota, securityNamespace } from "../../common/security/shared-quota.js";
import { ProviderError } from "./provider.http.js";

export const providerHosts: Record<string, string> = {
  "places.googleapis.com": "google",
  "rsapi.goong.io": "goong",
  "places-api.foursquare.com": "foursquare",
  "api.geoapify.com": "geoapify",
  "www.themealdb.com": "themealdb",
  "api.spoonacular.com": "spoonacular",
};
export function providerRequestLimit(env = process.env) {
  const value = Number(env.PROVIDER_REQUESTS_PER_MINUTE?.trim() || 120);
  if (!Number.isInteger(value) || value < 1 || value > 10000)
    throw new Error("Invalid PROVIDER_REQUESTS_PER_MINUTE");
  return value;
}
export function quotaFetch(
  prisma: PrismaClient,
  env = process.env,
  fetcher: typeof fetch = (input, options) => fetch(input, options),
): typeof fetch {
  const namespace = securityNamespace({ ...process.env, ...env }),
    limit = providerRequestLimit(env);
  return async (input, options) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const provider = providerHosts[url.hostname];
    if (!provider || url.protocol !== "https:" || url.username || url.password || url.port)
      throw new ProviderError("UNAVAILABLE");
    const observe = async (status: "OK" | "UNAVAILABLE" | "QUOTA_EXCEEDED", requested: boolean) => {
      await prisma.$executeRaw`
        INSERT INTO provider_observations(namespace,provider,last_attempt_at,last_success_at,last_status,requests,failures,quota_rejections)
        VALUES (${namespace},${provider},NOW(),CASE WHEN ${status}='OK' THEN NOW() ELSE NULL END,${status},${requested ? 1 : 0},${status === "UNAVAILABLE" ? 1 : 0},${status === "QUOTA_EXCEEDED" ? 1 : 0})
        ON CONFLICT(namespace,provider) DO UPDATE SET last_attempt_at=NOW(),last_status=EXCLUDED.last_status,
          last_success_at=COALESCE(EXCLUDED.last_success_at,provider_observations.last_success_at),
          requests=provider_observations.requests+EXCLUDED.requests,
          failures=provider_observations.failures+EXCLUDED.failures,
          quota_rejections=provider_observations.quota_rejections+EXCLUDED.quota_rejections`;
    };
    try {
      const reservation = await reserveQuota(
        prisma,
        `provider:${provider}`,
        "global",
        limit,
        60000,
        namespace,
      );
      if (!reservation.allowed) {
        await observe("QUOTA_EXCEEDED", false);
        throw new ProviderError("QUOTA_EXCEEDED");
      }
      let response: Response;
      try {
        response = await fetcher(input, options);
      } catch {
        await observe("UNAVAILABLE", true);
        throw new ProviderError("UNAVAILABLE");
      }
      const status =
        response.status === 429 || response.status === 402
          ? "QUOTA_EXCEEDED"
          : response.ok
            ? "OK"
            : "UNAVAILABLE";
      await observe(status, true);
      return response;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError("UNAVAILABLE");
    }
  };
}
