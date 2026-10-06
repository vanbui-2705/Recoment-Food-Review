import "dotenv/config";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/app.js";
import { createRateLimitHook } from "../src/common/security/rate-limit.js";

const previousNamespace = process.env.SECURITY_NAMESPACE;
const namespace = `benchmark-${randomUUID()}`;
process.env.SECURITY_NAMESPACE = namespace;
const replicas = [buildApp({ logger: false }), buildApp({ logger: false })];
try {
  for (const app of replicas) {
    app.get(
      "/shared-limit-benchmark",
      { preHandler: createRateLimitHook({ keyPrefix: "benchmark", limit: 20, windowMs: 60000 }) },
      async () => ({ accepted: true }),
    );
    await app.ready();
  }
  const started = performance.now();
  const measurements = await Promise.all(
    Array.from({ length: 100 }, async (_, index) => {
      const start = performance.now(),
        result = await replicas[index % 2]!.inject({
          url: "/shared-limit-benchmark",
          remoteAddress: "127.0.0.1",
        });
      return { status: result.statusCode, milliseconds: performance.now() - start };
    }),
  );
  const times = measurements.map((row) => row.milliseconds).sort((a, b) => a - b);
  const accepted = measurements.filter((row) => row.status === 200).length,
    rejected = measurements.filter((row) => row.status === 429).length;
  console.log(
    JSON.stringify({
      benchmark: "PostgreSQL shared quota, two Fastify instances",
      concurrent: 100,
      accepted,
      rejected,
      unexpected: 100 - accepted - rejected,
      durationMs: Math.round(performance.now() - started),
      p50Ms: Math.round(times[49]!),
      p95Ms: Math.round(times[94]!),
    }),
  );
  if (accepted !== 20 || rejected !== 80) process.exitCode = 1;
} finally {
  for (const app of replicas) {
    if (app.hasDecorator("prisma"))
      await app.prisma.sharedQuotaBucket.deleteMany({ where: { namespace } });
    await app.close();
  }
  if (previousNamespace === undefined) delete process.env.SECURITY_NAMESPACE;
  else process.env.SECURITY_NAMESPACE = previousNamespace;
}
