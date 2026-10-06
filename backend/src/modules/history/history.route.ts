import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { createHistoryService } from "./history.service.js";
const Kind = Type.Union([Type.Literal("DISH"), Type.Literal("RECIPE")]);
const Params = Type.Object(
  { kind: Kind, id: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);
export const historyRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const service = createHistoryService(app.prisma);
  app.get(
    "/users/me/history",
    {
      schema: {
        querystring: Type.Object(
          {
            cursor: Type.Optional(Type.String({ maxLength: 400 })),
            kind: Type.Optional(Kind),
            type: Type.Optional(Type.Union([Type.Literal("CHOSEN"), Type.Literal("EATEN")])),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => ({ data: await service.list(request.authUser!.id, request.query) }),
  );
  app.get(
    "/users/me/history/:kind/:id/deletion-preview",
    { schema: { params: Params } },
    async (request) => ({
      data: await service.preview(request.authUser!.id, request.params.kind, request.params.id),
    }),
  );
  app.delete(
    "/users/me/history/:kind/:id",
    {
      preHandler: createRateLimitHook({ keyPrefix: "history-delete", limit: 20, windowMs: 60000 }),
      schema: {
        params: Params,
        body: Type.Object(
          {
            confirm: Type.Literal(true),
            expectedVersion: Type.String({ pattern: "^[a-f0-9]{64}$" }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => ({
      data: await service.remove(
        request.authUser!.id,
        request.params.kind,
        request.params.id,
        request.body.expectedVersion,
      ),
    }),
  );
};
