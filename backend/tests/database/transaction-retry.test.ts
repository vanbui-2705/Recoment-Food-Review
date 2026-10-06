import { randomUUID } from "node:crypto";
import { it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import { serializableWrite } from "../../src/common/security/transaction-retry.js";
const apps = [buildApp({ logger: false }), buildApp({ logger: false })];
beforeAll(async () => {
  for (const app of apps) await app.ready();
});
afterAll(async () => {
  for (const app of apps) await app.close();
});
it("retries the real adapter's wrapped raw-query serialization failure in a fresh transaction", async () => {
  const user = await apps[0]!.prisma.user.create({
    data: {
      email: `serialization-${randomUUID()}@test.local`,
      displayName: "Fixture",
      passwordHash: "unused",
    },
  });
  let reads = 0,
    attempts = 0,
    release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const first = apps[0]!.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid`;
        if (++reads === 2) release();
        await barrier;
        await tx.$queryRaw`UPDATE users SET display_name='First writer' WHERE id=${user.id}::uuid RETURNING id`;
      },
      { isolationLevel: "Serializable" },
    );
    const second = serializableWrite(apps[1]!.prisma, async (tx) => {
      attempts++;
      await tx.$queryRaw`SELECT id FROM users WHERE id=${user.id}::uuid`;
      if (attempts === 1) {
        if (++reads === 2) release();
        await barrier;
      }
      await first;
      await tx.$queryRaw`UPDATE users SET display_name='Second writer' WHERE id=${user.id}::uuid RETURNING id`;
    });
    await Promise.all([first, second]);
    expect(attempts).toBe(2);
    expect(
      (await apps[0]!.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).displayName,
    ).toBe("Second writer");
  } finally {
    await apps[0]!.prisma.user.delete({ where: { id: user.id } });
  }
});
