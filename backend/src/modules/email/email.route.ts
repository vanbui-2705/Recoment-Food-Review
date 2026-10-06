import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { loadEmailConfig } from "./email.config.js";
import { createEmailProvider } from "./email.provider.js";
import { createEmailService } from "./email.service.js";
const token = Type.String({ minLength: 43, maxLength: 43, pattern: "^[A-Za-z0-9_-]{43}$" });
export const accountEmailRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const config = loadEmailConfig(),
    service = createEmailService(app.prisma, config, createEmailProvider(config));
  const limit = createRateLimitHook({ keyPrefix: "account-email", limit: 5, windowMs: 15 * 60000 });
  const claimLimit = createRateLimitHook({
    keyPrefix: "account-email-claim",
    limit: 10,
    windowMs: 15 * 60000,
  });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.post(
    "/auth/forgot-password",
    {
      preHandler: limit,
      schema: {
        body: Type.Object(
          { email: Type.String({ format: "email", maxLength: 255 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      await service.enqueue(req.body.email, "RESET");
      return {
        data: {
          status: "ACCEPTED",
          message:
            "Nếu email thuộc tài khoản đang hoạt động, yêu cầu khôi phục sẽ được xử lý. Hãy kiểm tra hộp thư và thư rác sau vài phút.",
        },
      };
    },
  );
  for (const path of ["/auth/resend-verification", "/auth/email-verification"])
    app.post(path, { preHandler: [app.authenticate, limit] }, async (req) => {
      await service.enqueue(req.authUser!.email, "VERIFY");
      return {
        data: {
          status: "ACCEPTED",
          message:
            "Yêu cầu xác minh đã được tiếp nhận. Nếu email chưa xác minh, hệ thống sẽ xử lý gửi liên kết.",
        },
      };
    });
  app.get("/auth/email-status", { preHandler: app.authenticate }, async (req) => {
    const user = await app.prisma.user.findUniqueOrThrow({
      where: { id: req.authUser!.id },
      select: { email: true, emailVerifiedAt: true },
    });
    return { data: { ...user, configured: service.configured } };
  });
  app.post(
    "/auth/reset-password",
    {
      preHandler: claimLimit,
      schema: {
        body: Type.Object(
          { token, newPassword: Type.String({ minLength: 8, maxLength: 255 }) },
          { additionalProperties: false },
        ),
      },
    },
    async (req, reply) => {
      await service.consume(req.body.token, "RESET", req.body.newPassword);
      return reply.status(204).send();
    },
  );
  app.post(
    "/auth/verify-email",
    {
      preHandler: claimLimit,
      schema: { body: Type.Object({ token }, { additionalProperties: false }) },
    },
    async (req, reply) => {
      await service.consume(req.body.token, "VERIFY");
      return reply.status(204).send();
    },
  );
};
