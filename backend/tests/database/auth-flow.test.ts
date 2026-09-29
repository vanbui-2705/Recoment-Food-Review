import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword } from "../../src/common/security/password.js";
import { UserRole } from "../../src/generated/prisma/enums.js";
import { buildApp } from "../../src/app.js";

describe("authentication routes", () => {
  let app: FastifyInstance;
  const suffix = randomUUID();
  const userEmail = `auth-flow-${suffix}@rec-food.local`;
  const adminEmail = `admin-flow-${suffix}@rec-food.local`;

  beforeAll(async () => {
    app = buildApp({ logger: false, database: true });
    await app.ready();

    await app.prisma.user.create({
      data: {
        email: adminEmail,
        displayName: "Auth Flow Admin",
        passwordHash: await hashPassword("admin-password"),
        role: UserRole.ADMIN,
      },
    });
  });

  afterAll(async () => {
    if (app.hasDecorator("prisma")) {
      await app.prisma.user.deleteMany({ where: { email: { in: [userEmail, adminEmail] } } });
    }
    await app.close();
  });

  it("runs register, login, me, refresh rotation, logout, and role checks", async () => {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: userEmail,
        password: "user-password",
        displayName: "Auth Flow User",
      },
    });
    expect(register.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: userEmail.toUpperCase(), password: "user-password" },
    });
    expect(login.statusCode).toBe(200);
    const firstSession = login.json().data;

    const me = await app.inject({
      method: "GET",
      url: "/users/me",
      headers: { authorization: `Bearer ${firstSession.accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.user.email).toBe(userEmail);

    const forbidden = await app.inject({
      method: "GET",
      url: "/admin/access-check",
      headers: { authorization: `Bearer ${firstSession.accessToken}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const refresh = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: firstSession.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    const secondSession = refresh.json().data;
    expect(secondSession.refreshToken).not.toBe(firstSession.refreshToken);

    const reused = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: firstSession.refreshToken },
    });
    expect(reused.statusCode).toBe(401);

    const logout = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken: secondSession.refreshToken },
    });
    expect(logout.statusCode).toBe(204);

    const afterLogout = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: secondSession.refreshToken },
    });
    expect(afterLogout.statusCode).toBe(401);

    const relogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: userEmail, password: "user-password" },
    });
    expect(relogin.statusCode).toBe(200);
    const reloginSession = relogin.json().data;

    const changePassword = await app.inject({
      method: "POST",
      url: "/auth/change-password",
      headers: { authorization: `Bearer ${reloginSession.accessToken}` },
      payload: { currentPassword: "user-password", newPassword: "new-user-password" },
    });
    expect(changePassword.statusCode).toBe(204);

    const afterPasswordChange = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: reloginSession.refreshToken },
    });
    expect(afterPasswordChange.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: userEmail, password: "new-user-password" },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it("allows an admin to access the role-protected endpoint", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: adminEmail, password: "admin-password" },
    });
    expect(login.statusCode).toBe(200);

    const response = await app.inject({
      method: "GET",
      url: "/admin/access-check",
      headers: { authorization: `Bearer ${login.json().data.accessToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.authorized).toBe(true);
  });
});
