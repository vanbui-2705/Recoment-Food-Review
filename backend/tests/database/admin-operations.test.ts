import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { signAccessToken } from "../../src/common/security/token.js";
import { loadEnv } from "../../src/config/env.js";
const app = buildApp({ logger: false }),
  ids: string[] = [];
let admin: { authorization: string }, user: { authorization: string }, subject: string;
beforeAll(async () => {
  vi.stubEnv("WORKER_ENABLED", "true");
  await app.ready();
  for (const role of ["ADMIN", "USER"] as const) {
    const row = await app.prisma.user.create({
      data: {
        email: `operations-${randomUUID()}@test.local`,
        displayName: "Test operations",
        role,
        passwordHash: "unused",
      },
    });
    ids.push(row.id);
    const headers = {
      authorization: `Bearer ${await signAccessToken({ userId: row.id, role }, loadEnv().jwtAccessSecret, 300)}`,
    };
    if (role === "ADMIN") admin = headers;
    else user = headers;
  }
  const row = await app.prisma.user.create({
    data: {
      email: `deletion-${randomUUID()}@test.local`,
      displayName: "Deletion fixture",
      passwordHash: "unused",
      status: "DISABLED",
    },
  });
  subject = row.id;
  ids.push(subject);
});
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app.close();
  vi.unstubAllEnvs();
});
it("restricts operation state and every retry write to ADMIN, with no credentials or personal data", async () => {
  for (const url of ["/admin/operations", "/admin/operations/account-deletions"]) {
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: user })).statusCode).toBe(403);
  }
  const result = await app.inject({ url: "/admin/operations", headers: admin });
  expect(result.statusCode).toBe(200);
  expect(result.headers["cache-control"]).toBe("no-store");
  expect(result.json().data.providers).toHaveLength(6);
  expect(result.body).not.toMatch(
    /apiKey|passwordHash|encryptedBody|Authorization|Bearer|@test.local/,
  );
  for (const id of ids) expect(result.body).not.toContain(id);
});
it("retries only a failed disabled account job once with CAS and a transactional audit", async () => {
  const job = await app.prisma.accountDeletionJob.create({
    data: { userId: subject, status: "FAILED", attempts: 5, errorCode: "ACCOUNT_DELETE_FAILED" },
  });
  const url = `/admin/operations/account-deletions/${job.id}/retry`,
    payload = { confirm: true, expectedUpdatedAt: job.updatedAt.toISOString() };
  expect((await app.inject({ method: "POST", url, headers: user, payload })).statusCode).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url,
        headers: admin,
        payload: { ...payload, confirm: false },
      })
    ).statusCode,
  ).toBe(400);
  const rows = await Promise.all(
    [1, 2].map(() => app.inject({ method: "POST", url, headers: admin, payload })),
  );
  expect(rows.map((row) => row.statusCode).sort()).toEqual([200, 409]);
  expect(
    await app.prisma.accountDeletionJob.findUniqueOrThrow({ where: { id: job.id } }),
  ).toMatchObject({ status: "QUEUED", attempts: 0, errorCode: null });
  expect(
    await app.prisma.adminAudit.count({
      where: { action: "ACCOUNT_DELETE_RETRY", targetId: subject },
    }),
  ).toBe(1);
  const listed = await app.inject({
    url: "/admin/operations/account-deletions?limit=50",
    headers: admin,
  });
  expect(listed.body).not.toContain(subject);
  expect(listed.body).not.toContain("leaseToken");
});
