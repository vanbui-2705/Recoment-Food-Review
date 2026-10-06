import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/common/security/password.js";
import { signAccessToken } from "../../src/common/security/token.js";
import { loadEnv } from "../../src/config/env.js";

describe("account sessions and immediate revocation", () => {
  let app: FastifyInstance, ownerId: string, otherId: string;
  const ownerEmail = `sessions-${randomUUID()}@rec-food.local`,
    otherEmail = `sessions-${randomUUID()}@rec-food.local`;
  let ip = 1;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });
  async function login(email = ownerEmail, password = "original-password") {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      remoteAddress: `127.0.0.${ip++}`,
      payload: { email, password },
      headers: { "user-agent": "Account test device" },
    });
    expect(response.statusCode).toBe(200);
    return response.json().data as { accessToken: string; refreshToken: string };
  }
  beforeAll(async () => {
    app = buildApp({ logger: false, database: true });
    await app.ready();
    const passwordHash = await hashPassword("original-password");
    ownerId = (
      await app.prisma.user.create({
        data: { email: ownerEmail, displayName: "Owner", passwordHash },
      })
    ).id;
    otherId = (
      await app.prisma.user.create({
        data: { email: otherEmail, displayName: "Other", passwordHash },
      })
    ).id;
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
    await app.close();
  });
  it("lists only owned device families, retains the family across rotation and denies cross-owner revocation", async () => {
    const a = await login(),
      b = await login(),
      other = await login(otherEmail);
    const legacy = await signAccessToken(
      { userId: ownerId, role: "USER" },
      loadEnv().jwtAccessSecret,
      900,
    );
    const list = await app.inject({ url: "/auth/sessions", headers: headers(a.accessToken) });
    expect(list.headers["cache-control"]).toBe("no-store");
    const items = list.json().data.items;
    expect(items).toHaveLength(2);
    expect(items.filter((item: { current: boolean }) => item.current)).toHaveLength(1);
    expect(JSON.stringify(items)).not.toMatch(/tokenHash|ipAddress|passwordHash/);
    const foreign = await app.inject({
      method: "DELETE",
      url: `/auth/sessions/${items[0].id}`,
      headers: headers(other.accessToken),
    });
    expect(foreign.statusCode).toBe(404);
    const refresh = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: a.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    const rotated = refresh.json().data;
    const after = await app.inject({
      url: "/auth/sessions",
      headers: headers(rotated.accessToken),
    });
    expect(after.json().data.items.find((item: { current: boolean }) => item.current).id).toBe(
      items.find((item: { current: boolean }) => item.current).id,
    );
    const revoked = await app.inject({
      method: "DELETE",
      url: `/auth/sessions/${items.find((item: { current: boolean }) => item.current).id}`,
      headers: headers(b.accessToken),
    });
    expect(revoked.statusCode).toBe(204);
    for (const token of [a.accessToken, rotated.accessToken, legacy])
      expect((await app.inject({ url: "/users/me", headers: headers(token) })).statusCode).toBe(
        401,
      );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/refresh",
          payload: { refreshToken: rotated.refreshToken },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ url: "/users/me", headers: headers(b.accessToken) })).statusCode,
    ).toBe(200);
  });
  it("revokes legacy access as well as all device access and refresh on password change", async () => {
    const a = await login(),
      b = await login();
    const legacy = await signAccessToken(
      { userId: ownerId, role: "USER" },
      loadEnv().jwtAccessSecret,
      900,
    );
    const invalid = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: headers(a.accessToken),
      payload: { currentPassword: "wrong", newPassword: "new-password" },
    });
    expect(invalid.statusCode).toBe(401);
    expect(
      (await app.inject({ url: "/users/me", headers: headers(a.accessToken) })).statusCode,
    ).toBe(200);
    const changed = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: headers(a.accessToken),
      payload: { currentPassword: "original-password", newPassword: "new-password" },
    });
    expect(changed.statusCode).toBe(204);
    for (const token of [a.accessToken, b.accessToken, legacy])
      expect((await app.inject({ url: "/users/me", headers: headers(token) })).statusCode).toBe(
        401,
      );
    for (const session of [a, b])
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: { refreshToken: session.refreshToken },
          })
        ).statusCode,
      ).toBe(401);
    await login(ownerEmail, "new-password");
  });
  it("normalizes the name, rejects role injection and logout-all invalidates access immediately", async () => {
    const session = await login(ownerEmail, "new-password");
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/users/me/name",
          headers: headers(session.accessToken),
          payload: { displayName: "  Tên    mới  " },
        })
      ).json().data.displayName,
    ).toBe("Tên mới");
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/users/me/name",
          headers: headers(session.accessToken),
          payload: { displayName: "Owner", role: "ADMIN" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/logout-all",
          headers: headers(session.accessToken),
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await app.inject({ url: "/users/me", headers: headers(session.accessToken) })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/auth/refresh",
          payload: { refreshToken: session.refreshToken },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("serializes refresh versus logout without resurrecting a revoked family", async () => {
    const session = await login(ownerEmail, "new-password");
    const [refresh, logout] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: session.refreshToken },
      }),
      app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: { refreshToken: session.refreshToken },
      }),
    ]);
    expect(logout.statusCode).toBe(204);
    expect([200, 401]).toContain(refresh.statusCode);
    expect(
      (await app.inject({ url: "/users/me", headers: headers(session.accessToken) })).statusCode,
    ).toBe(401);
    if (refresh.statusCode === 200) {
      expect(
        (await app.inject({ url: "/users/me", headers: headers(refresh.json().data.accessToken) }))
          .statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/auth/refresh",
            payload: { refreshToken: refresh.json().data.refreshToken },
          })
        ).statusCode,
      ).toBe(401);
    }
  });
});
