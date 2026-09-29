import { describe, expect, it } from "vitest";

import { loadEnv } from "../../src/config/env.js";

const DATABASE_URL = "postgresql://test:test@localhost:5432/test";
const JWT_ACCESS_SECRET = "test-jwt-access-secret-that-is-long-enough";

describe("loadEnv", () => {
  it("đọc cấu hình hợp lệ", () => {
    expect(
      loadEnv({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "4000",
        DATABASE_URL,
        JWT_ACCESS_SECRET,
        ACCESS_TOKEN_TTL_SECONDS: "600",
        REFRESH_TOKEN_TTL_DAYS: "14",
      }),
    ).toEqual({
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 4000,
      databaseUrl: DATABASE_URL,
      jwtAccessSecret: JWT_ACCESS_SECRET,
      accessTokenTtlSeconds: 600,
      refreshTokenTtlDays: 14,
    });
  });

  it("dùng giá trị mặc định", () => {
    expect(loadEnv({ DATABASE_URL })).toEqual({
      nodeEnv: "development",
      host: "0.0.0.0",
      port: 3001,
      databaseUrl: DATABASE_URL,
      jwtAccessSecret: "development-only-replace-jwt-access-secret-please",
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
    });
  });

  it("từ chối PORT không hợp lệ", () => {
    expect(() => loadEnv({ PORT: "abc", DATABASE_URL })).toThrow(
      "PORT phải là số nguyên từ 1 đến 65535",
    );
  });

  it("từ chối NODE_ENV không hợp lệ", () => {
    expect(() => loadEnv({ NODE_ENV: "local", DATABASE_URL })).toThrow(
      "NODE_ENV phải là một trong các giá trị: development, test, production",
    );
  });

  it("yêu cầu DATABASE_URL", () => {
    expect(() => loadEnv({})).toThrow("DATABASE_URL là biến môi trường bắt buộc");
  });

  it("yêu cầu JWT secret đủ mạnh trong production", () => {
    expect(() =>
      loadEnv({ NODE_ENV: "production", DATABASE_URL, JWT_ACCESS_SECRET: "short" }),
    ).toThrow("JWT_ACCESS_SECRET production phải có ít nhất 32 ký tự");
  });
});
