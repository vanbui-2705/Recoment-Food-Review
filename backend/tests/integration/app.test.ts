import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";

describe("Application", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("GET /health trả trạng thái ok", async () => {
    app = buildApp({ logger: false, database: false });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "Rec-Food Backend",
      timestamp: expect.any(String),
    });
  });

  it("route không tồn tại trả lỗi chuẩn hóa", async () => {
    app = buildApp({ logger: false, database: false });

    const response = await app.inject({ method: "GET", url: "/does-not-exist" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Không tìm thấy endpoint",
      },
      request_id: expect.any(String),
    });
  });

  it("lỗi nội bộ không làm lộ nội dung lỗi", async () => {
    app = buildApp({ logger: false, database: false });
    app.get("/test-error", async () => {
      throw new Error("Thông tin nội bộ không được lộ");
    });

    const response = await app.inject({ method: "GET", url: "/test-error" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Đã xảy ra lỗi hệ thống",
      },
    });
    expect(response.body).not.toContain("Thông tin nội bộ không được lộ");
  });
});
