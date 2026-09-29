import type { FastifyInstance } from "fastify";

import { AppError } from "./app-error.js";

type ValidationErrorLike = {
  validation: unknown[];
};

function hasValidationErrors(error: unknown): error is ValidationErrorLike {
  if (typeof error !== "object" || error === null || !("validation" in error)) {
    return false;
  }

  return Array.isArray(error.validation);
}

export function registerErrorHandlers(app: FastifyInstance): void {
  // Chuẩn hóa lỗi 404 để mọi lỗi API có cùng cấu trúc error + request_id.
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Không tìm thấy endpoint",
        details: [],
      },
      request_id: request.id,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    // Lỗi do Fastify/TypeBox phát hiện khi request không đúng schema.
    if (hasValidationErrors(error)) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu đầu vào không hợp lệ",
          details: error.validation,
        },
        request_id: request.id,
      });
    }

    // Lỗi nghiệp vụ đã biết, ví dụ email đăng ký bị trùng.
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? [],
        },
        request_id: request.id,
      });
    }

    // Lỗi không dự kiến chỉ được ghi vào server log; không trả stack/message nội bộ cho client.
    request.log.error({ err: error }, "Unhandled application error");

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Đã xảy ra lỗi hệ thống",
        details: [],
      },
      request_id: request.id,
    });
  });
}
