import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
// Isolate test quotas and observations from development data without resetting live counters.
const namespace = `test-${randomUUID()}`;
process.env.SECURITY_NAMESPACE = namespace;
afterAll(async () => {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await db.sharedQuotaBucket.deleteMany({ where: { namespace } });
    await db.providerObservation.deleteMany({ where: { namespace } });
  } finally {
    await db.$disconnect();
  }
});
