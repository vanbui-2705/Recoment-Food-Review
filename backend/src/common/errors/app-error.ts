export type ErrorDetails = Record<string, unknown> | unknown[];

// Lỗi nghiệp vụ có chủ đích; global error handler sẽ chuyển nó thành HTTP response an toàn.
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetails | undefined;

  public constructor(statusCode: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Giữ stack trace bắt đầu tại nơi tạo AppError, giúp log khi debug dễ đọc hơn.
    Error.captureStackTrace(this, AppError);
  }
}
