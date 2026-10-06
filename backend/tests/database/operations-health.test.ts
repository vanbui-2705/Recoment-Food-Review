import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { buildApp } from "../../src/app.js";
import { signAccessToken } from "../../src/common/security/token.js";
import { loadEnv } from "../../src/config/env.js";
import { vi } from "vitest";
const app = buildApp({ logger: false, database: true }),
  ids: string[] = [];
let admin: { authorization: string }, user: { authorization: string };
beforeAll(async () => {
  await app.ready();
  for (const role of ["ADMIN", "USER"] as const) {
    const row = await app.prisma.user.create({
      data: {
        email: `ops-${randomUUID()}@rec-food.local`,
        displayName: "Operations Test",
        passwordHash: "unused",
        role,
      },
    });
    ids.push(row.id);
    const headers = {
      authorization: `Bearer ${await signAccessToken({ userId: row.id, role }, loadEnv().jwtAccessSecret, 300)}`,
    };
    if (role === "ADMIN") admin = headers;
    else user = headers;
  }
});
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app.close();
});
it("checks the database and protects aggregate metrics without user identifiers", async () => {
  expect((await app.inject({ url: "/ready" })).json()).toEqual({ status: "ok", database: "ready" });
  expect((await app.inject({ url: "/admin/metrics" })).statusCode).toBe(401);
  expect((await app.inject({ url: "/admin/metrics", headers: user })).statusCode).toBe(403);
  const metrics = await app.inject({ url: "/admin/metrics", headers: admin });
  expect(metrics.statusCode).toBe(200);
  expect(metrics.headers["content-type"]).toContain("text/plain");
  expect(metrics.body).toContain("food_ai_requests_today");
  for (const id of ids) expect(metrics.body).not.toContain(id);
  expect(metrics.body).not.toMatch(/email|password|token|api_key|description/);
});
it("reports a database failure with 503 without exposing credentials", async () => {
  const failure = vi
    .spyOn(app.prisma, "$transaction")
    .mockRejectedValueOnce(new Error("postgresql://private-secret"));
  try {
    const ready = await app.inject({ url: "/ready" });
    expect(ready.statusCode).toBe(503);
    expect(ready.body).not.toContain("private-secret");
  } finally {
    failure.mockRestore();
  }
});
