import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { createRateLimitHook } from "../../src/common/security/rate-limit.js";
import { reserveQuota } from "../../src/common/security/shared-quota.js";
import { quotaFetch } from "../../src/modules/discovery/provider.quota.js";

const replicas = [buildApp({ logger: false }), buildApp({ logger: false })];
beforeAll(async () => {
  for (const app of replicas) {
    app.get(
      "/quota-benchmark",
      {
        preHandler: createRateLimitHook({
          keyPrefix: "replica-benchmark",
          limit: 12,
          windowMs: 60000,
        }),
      },
      async () => ({ ok: true }),
    );
    await app.ready();
  }
});
afterAll(async () => {
  for (const app of replicas) await app.close();
});
it("accepts exactly the shared limit across independent app instances under concurrent requests", async () => {
  const start = performance.now();
  const results = await Promise.all(
    Array.from({ length: 64 }, (_, index) =>
      replicas[index % 2]!.inject({ url: "/quota-benchmark", remoteAddress: "10.90.0.1" }),
    ),
  );
  expect(results.filter((result) => result.statusCode === 200)).toHaveLength(12);
  expect(results.filter((result) => result.statusCode === 429)).toHaveLength(52);
  expect(
    results
      .filter((result) => result.statusCode === 429)
      .every((result) => Number(result.headers["retry-after"]) > 0),
  ).toBe(true);
  console.info(
    JSON.stringify({
      benchmark: "two-replica-shared-rate",
      concurrentRequests: 64,
      accepted: 12,
      rejected: 52,
      durationMs: Math.round(performance.now() - start),
    }),
  );
  const bucket = await replicas[0]!.prisma.sharedQuotaBucket.findFirstOrThrow({
    where: { namespace: process.env.SECURITY_NAMESPACE, scope: "rate:replica-benchmark" },
  });
  expect(bucket.count).toBe(12);
  expect(bucket.key).not.toContain("10.90.0.1");
});
it("resets expired buckets, separates identities and fails closed when the shared store fails", async () => {
  const prisma = replicas[0]!.prisma,
    scope = `test:${randomUUID()}`;
  expect((await reserveQuota(prisma, scope, "owner", 1, 60000)).allowed).toBe(true);
  expect((await reserveQuota(prisma, scope, "owner", 1, 60000)).allowed).toBe(false);
  expect((await reserveQuota(prisma, scope, "other", 1, 60000)).allowed).toBe(true);
  await prisma.sharedQuotaBucket.updateMany({
    where: { scope },
    data: { resetAt: new Date(Date.now() - 1000) },
  });
  expect((await reserveQuota(prisma, scope, "owner", 1, 60000)).allowed).toBe(true);
  const failure = vi
    .spyOn(prisma, "$transaction")
    .mockRejectedValueOnce(new Error("private-database-secret"));
  try {
    const result = await replicas[0]!.inject({
      url: "/quota-benchmark",
      remoteAddress: "10.90.0.2",
    });
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain("private-database-secret");
  } finally {
    failure.mockRestore();
  }
});
it("bounds provider fan-out across two clients without persisting URLs or credentials", async () => {
  const fake = vi.fn(async () => new Response('{"meals":[]}'));
  const clients = replicas.map((app) =>
    quotaFetch(app.prisma, { PROVIDER_REQUESTS_PER_MINUTE: "5" }, fake),
  );
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, index) =>
      clients[index % 2]!(
        "https://www.themealdb.com/api/json/v1/private-key/search.php?s=private-taste",
      ),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(5);
  expect(fake).toHaveBeenCalledTimes(5);
  for (const result of results)
    if (result.status === "rejected") expect(result.reason.status).toBe("QUOTA_EXCEEDED");
  const observation = await replicas[0]!.prisma.providerObservation.findUniqueOrThrow({
    where: {
      namespace_provider: { namespace: process.env.SECURITY_NAMESPACE!, provider: "themealdb" },
    },
  });
  expect(observation.requests).toBe(5n);
  expect(observation.quotaRejections).toBe(15n);
  expect(String(observation)).not.toMatch(/private-key|private-taste/);
  await expect(clients[0]!("http://www.themealdb.com/unsafe")).rejects.toMatchObject({
    status: "UNAVAILABLE",
  });
  await expect(clients[0]!("https://evil.example/unsafe")).rejects.toMatchObject({
    status: "UNAVAILABLE",
  });
  expect(fake).toHaveBeenCalledTimes(5);
});
