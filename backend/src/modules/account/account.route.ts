import { Readable } from "node:stream";
import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { loadAiConfig } from "../ai/ai.config.js";
import { createAccountService } from "./account.service.js";
import { prepareExport } from "./account.export.js";
import { retention } from "./account.retention.js";
const password = Type.String({ minLength: 1, maxLength: 255 });
export const accountDataRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const enabled = loadAiConfig().workerEnabled,
    service = createAccountService(app.prisma, enabled);
  app.addHook("preHandler", app.authenticate);
  const sensitiveLimit = createRateLimitHook({
    keyPrefix: "account-data",
    limit: 5,
    windowMs: 15 * 60000,
  });
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.get("/users/me/data-controls", async () => ({
    data: {
      deletionAvailable: enabled,
      exportFormat: "JSONL",
      retention,
    },
  }));
  app.post(
    "/users/me/export",
    {
      preHandler: sensitiveLimit,
      schema: { body: Type.Object({ currentPassword: password }, { additionalProperties: false }) },
    },
    async (req, reply) => {
      const generator = await prepareExport(
        app.prisma,
        req.authUser!.id,
        req.body.currentPassword,
        req.authSessionId,
      );
      reply.type("application/x-ndjson; charset=utf-8");
      reply.header("Content-Disposition", 'attachment; filename="eatwise-personal-data.jsonl"');
      return reply.send(Readable.from(generator()));
    },
  );
  app.delete(
    "/users/me/account",
    {
      preHandler: sensitiveLimit,
      schema: {
        body: Type.Object(
          {
            currentPassword: password,
            confirm: Type.Literal(true),
            confirmation: Type.Literal("XÓA TÀI KHOẢN"),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req, reply) => {
      const data = await service.requestDeletion(req.authUser!.id, req.body.currentPassword);
      return reply.status(202).send({ data });
    },
  );
};
