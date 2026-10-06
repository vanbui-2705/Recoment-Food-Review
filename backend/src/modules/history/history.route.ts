import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { createHistoryService } from "./history.service.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { AppError } from "../../common/errors/app-error.js";
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
  app.post(
    "/users/me/history/:kind/:id/feedback",
    {
      preHandler: createRateLimitHook({
        keyPrefix: "history-feedback",
        limit: 40,
        windowMs: 60000,
      }),
      schema: {
        params: Params,
        body: Type.Object(
          {
            type: Type.Union([
              Type.Literal("RATED"),
              Type.Literal("LIKED"),
              Type.Literal("SKIPPED"),
            ]),
            rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
            idempotencyKey: Type.String({ format: "uuid" }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const userId = request.authUser!.id,
        { kind, id } = request.params,
        body = request.body;
      if ((body.type === "RATED") !== (body.rating !== undefined))
        throw new AppError(400, "INVALID_RATING", "Chỉ đánh giá mới được gửi số sao 1–5");
      const data = await serializableWrite(
        app.prisma,
        async (tx) => {
          const idempotencyKey = `${userId}:history:${body.idempotencyKey}`;
          if (kind === "DISH") {
            const parent = await tx.userInteraction.findFirst({
              where: { id, userId, interactionType: { in: ["CHOSEN", "EATEN"] } },
            });
            if (!parent)
              throw new AppError(
                404,
                "HISTORY_NOT_FOUND",
                "Không tìm thấy lần chọn hoặc ăn của bạn",
              );
            const previous = await tx.userInteraction.findUnique({ where: { idempotencyKey } });
            if (previous) {
              if (
                previous.feedbackOfId !== id ||
                previous.interactionType !== body.type ||
                previous.rating !== (body.rating ?? null)
              )
                throw new AppError(
                  409,
                  "IDEMPOTENCY_CONFLICT",
                  "Mã thao tác đã dùng cho phản hồi khác",
                );
              return { id: previous.id, type: previous.interactionType, rating: previous.rating };
            }
            // The same user key cannot switch from a recipe to a dish feedback.
            if (await tx.recipeInteraction.findUnique({ where: { idempotencyKey } }))
              throw new AppError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "Mã thao tác đã dùng cho phản hồi khác",
              );
            const row = await tx.userInteraction.create({
              data: {
                userId,
                dishId: parent.dishId,
                restaurantId: parent.restaurantId,
                recommendationResultId: parent.recommendationResultId,
                feedbackOfId: id,
                interactionType: body.type,
                rating: body.rating ?? null,
                idempotencyKey,
              },
            });
            return { id: row.id, type: row.interactionType, rating: row.rating };
          }
          const parent = await tx.recipeInteraction.findFirst({
            where: { id, userId, interactionType: { in: ["CHOSEN", "EATEN"] } },
          });
          if (!parent)
            throw new AppError(404, "HISTORY_NOT_FOUND", "Không tìm thấy lần chọn hoặc ăn của bạn");
          const previous = await tx.recipeInteraction.findUnique({ where: { idempotencyKey } });
          if (previous) {
            if (
              previous.feedbackOfId !== id ||
              previous.interactionType !== body.type ||
              previous.rating !== (body.rating ?? null)
            )
              throw new AppError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "Mã thao tác đã dùng cho phản hồi khác",
              );
            return { id: previous.id, type: previous.interactionType, rating: previous.rating };
          }
          if (await tx.userInteraction.findUnique({ where: { idempotencyKey } }))
            throw new AppError(
              409,
              "IDEMPOTENCY_CONFLICT",
              "Mã thao tác đã dùng cho phản hồi khác",
            );
          const row = await tx.recipeInteraction.create({
            data: {
              userId,
              source: parent.source,
              recipeId: parent.recipeId,
              title: parent.title,
              canonicalName: parent.canonicalName,
              canonicalDishId: parent.canonicalDishId,
              feedbackOfId: id,
              interactionType: body.type,
              rating: body.rating ?? null,
              idempotencyKey,
            },
          });
          return { id: row.id, type: row.interactionType, rating: row.rating };
        },
        true,
      );
      return { data };
    },
  );
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
