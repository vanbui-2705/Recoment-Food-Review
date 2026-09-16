import { describe, expect, it } from "vitest";

import { loadEnv } from "../../src/config/env.js";

const DATABASE_URL = "postgresql://test:test@localhost:5432/test";

describe("loadEnv", () => {
  it("đọc cấu hình hợp lệ", () => {
    expect(
      loadEnv({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "4000",
        DATABASE_URL,
      }),
    ).toEqual({
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 4000,
      databaseUrl: DATABASE_URL,
    });
  });

  it("dùng giá trị mặc định", () => {
    expect(loadEnv({ DATABASE_URL })).toEqual({
      nodeEnv: "development",
      host: "0.0.0.0",
      port: 3001,
      databaseUrl: DATABASE_URL,
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
});
