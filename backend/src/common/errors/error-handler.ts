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
