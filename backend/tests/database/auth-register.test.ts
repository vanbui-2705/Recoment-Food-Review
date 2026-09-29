import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";

describe("POST /auth/register", () => {
  let app: FastifyInstance;
  const suffix = randomUUID();
  const normalizedEmail = `register-${suffix}@rec-food.local`;

  beforeAll(async () => {
    app = buildApp({ logger: false, database: true });
    await app.ready();
  });

  afterAll(async () => {
    if (app.hasDecorator("prisma")) {
      await app.prisma.user.deleteMany({ where: { email: normalizedEmail } });
    }
    await app.close();
  });

  it("đăng ký user, chuẩn hóa dữ liệu và không trả password hash", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: `REGISTER-${suffix}@REC-FOOD.LOCAL`,
        password: "strong-password",
        displayName: "  Test   Register  ",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      data: {
        user: {
          email: normalizedEmail,
          displayName: "Test Register",
          role: "USER",
          createdAt: expect.any(String),
        },
      },
    });
    expect(response.body).not.toContain("password");

    const storedUser = await app.prisma.user.findUniqueOrThrow({
      where: { email: normalizedEmail },
    });
    expect(storedUser.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("coi email khác hoa thường là trùng", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: normalizedEmail.toUpperCase(),
        password: "another-password",
        displayName: "Duplicate User",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: "Email đã được sử dụng",
      },
    });
  });

  it.each([
    [
      "email sai định dạng",
      { email: "not-an-email", password: "strong-password", displayName: "Test User" },
    ],
    [
      "mật khẩu quá ngắn",
      { email: "short-password@example.com", password: "short", displayName: "Test User" },
    ],
  ])("từ chối %s", async (_name, payload) => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });
});
