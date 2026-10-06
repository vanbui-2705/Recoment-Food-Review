import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/common/security/password.js";

describe("audited account moderation", () => {
  const app = buildApp({ logger: false, database: true }),
    suffix = randomUUID();
  const ids: string[] = [];
  let admin: { authorization: string },
    user: { authorization: string },
    targetId: string,
    targetEmail: string,
    oldRefresh: string;
  beforeAll(async () => {
    await app.ready();
    const passwordHash = await hashPassword("moderation-password");
    for (const role of ["ADMIN", "USER"] as const) {
      const email = `${role.toLowerCase()}-${suffix}@rec-food.local`;
      const row = await app.prisma.user.create({
        data: { email, displayName: `Moderation ${role}`, passwordHash, role },
      });
      ids.push(row.id);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "moderation-password" },
      });
      expect(login.statusCode).toBe(200);
      const session = login.json().data;
      if (role === "ADMIN") admin = { authorization: `Bearer ${session.accessToken}` };
      else {
        user = { authorization: `Bearer ${session.accessToken}` };
        targetId = row.id;
        targetEmail = email;
        oldRefresh = session.refreshToken;
      }
    }
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });
  it("denies ordinary users every view and write without leaking credential data", async () => {
    for (const url of ["/admin/users", `/admin/users/${targetId}`, "/admin/audit"])
      expect((await app.inject({ url, headers: user })).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/users/${targetId}/status`,
          headers: user,
          payload: {
            status: "DISABLED",
            reasonCode: "SECURITY",
            expectedUpdatedAt: new Date().toISOString(),
          },
        })
      ).statusCode,
    ).toBe(403);
    const list = await app.inject({
      url: `/admin/users?q=${encodeURIComponent(suffix)}&page=1&limit=1`,
      headers: admin,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.total).toBe(2);
    expect(list.json().data.items).toHaveLength(1);
    expect(list.body).not.toMatch(/passwordHash|tokenHash|authVersion|ipAddress/);
    expect(list.headers["cache-control"]).toBe("no-store");
  });
  it("allows only one concurrent stale moderation, revokes access and refresh, and audits only bounded metadata", async () => {
    const target = await app.prisma.user.findUniqueOrThrow({ where: { id: targetId } });
    const body = {
      status: "DISABLED",
      reasonCode: "SECURITY",
      expectedUpdatedAt: target.updatedAt.toISOString(),
    };
    const results = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: "PUT",
          url: `/admin/users/${targetId}/status`,
          headers: admin,
          payload: body,
        }),
      ),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await app.inject({ url: "/users/me", headers: user })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/refresh",
          payload: { refreshToken: oldRefresh },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/login",
          payload: { email: targetEmail, password: "moderation-password" },
        })
      ).statusCode,
    ).toBe(401);
    const audits = await app.prisma.adminAudit.findMany({
      where: { targetId, action: "USER_STATUS_REVIEW" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toEqual({ from: "ACTIVE", to: "DISABLED", reasonCode: "SECURITY" });
    expect((await app.inject({ url: "/admin/audit?limit=1", headers: admin })).statusCode).toBe(
      200,
    );
  });
  it("unblocking keeps every old token revoked and requires a fresh login", async () => {
    const current = await app.inject({ url: `/admin/users/${targetId}`, headers: admin });
    const payload = {
      status: "ACTIVE",
      reasonCode: "REVIEW_COMPLETE",
      expectedUpdatedAt: current.json().data.updatedAt,
    };
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/users/${targetId}/status`,
          headers: admin,
          payload: { ...payload, role: "ADMIN" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/admin/users/${targetId}/status`,
          headers: admin,
          payload,
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ url: "/users/me", headers: user })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/refresh",
          payload: { refreshToken: oldRefresh },
        })
      ).statusCode,
    ).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: targetEmail, password: "moderation-password" },
    });
    expect(login.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          url: "/users/me",
          headers: { authorization: `Bearer ${login.json().data.accessToken}` },
        })
      ).statusCode,
    ).toBe(200);
  });
});
