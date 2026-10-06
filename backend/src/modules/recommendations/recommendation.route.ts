import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { AppError } from "../../common/errors/app-error.js";
import { createRecommendationService } from "./recommendation.service.js";
import { REPEAT_WINDOW_MS } from "../food/food.policy.js";
import { safetyDecision } from "../merchant-menu/safety.policy.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
export const recommendationRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const service = createRecommendationService(app.prisma);
  app.post(
    "/recommendations/:id/feedback",
    {
      preHandler: createRateLimitHook({
        keyPrefix: "recommendation-feedback",
        limit: 40,
        windowMs: 60000,
      }),
      schema: {
        params: Type.Object(
          { id: Type.String({ format: "uuid" }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            resultId: Type.String({ format: "uuid" }),
            idempotencyKey: Type.String({ format: "uuid" }),
            type: Type.Union([
              Type.Literal("CHOSEN"),
              Type.Literal("EATEN"),
              Type.Literal("RATED"),
              Type.Literal("SKIPPED"),
              Type.Literal("LIKED"),
            ]),
            rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
            eatenAt: Type.Optional(Type.String({ format: "date-time" })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const userId = request.authUser!.id,
        body = request.body,
        now = new Date();
      if ((body.type === "RATED") !== (body.rating !== undefined))
        throw new AppError(400, "INVALID_RATING", "Chỉ đánh giá mới được gửi số sao 1–5");
      if (body.eatenAt && body.type !== "EATEN")
        throw new AppError(400, "INVALID_EATEN_AT", "Chỉ món đã ăn mới có thời điểm ăn");
      const createdAt = body.eatenAt ? new Date(body.eatenAt) : now;
      if (createdAt > now || +createdAt < +now - 30 * 86400000)
        throw new AppError(400, "INVALID_EATEN_AT", "Thời điểm ăn phải trong 30 ngày vừa qua");
      const choosing = body.type === "CHOSEN";
      if (choosing) {
        const [ownedRequest, replay] = await Promise.all([
          app.prisma.recommendationRequest.findFirst({
            where: { id: request.params.id, userId },
            select: { onlyOpen: true },
          }),
          app.prisma.userInteraction.findUnique({
            where: { idempotencyKey: `${userId}:${body.idempotencyKey}` },
            select: { id: true },
          }),
        ]);
        if (ownedRequest?.onlyOpen && !replay) {
          const current = await service.get(userId, request.params.id);
          if (current.items.find((item) => item.id === body.resultId)?.openNow !== true)
            throw new AppError(
              409,
              "OFFER_NO_LONGER_ELIGIBLE",
              "Chưa xác nhận quán đang mở; hãy tìm lại",
            );
        }
      }
      const data = await serializableWrite(
        app.prisma,
        async (tx) => {
          const result = await tx.recommendationResult.findFirst({
            where: { id: body.resultId, requestId: request.params.id, request: { userId } },
            include: {
              request: { select: { budgetMax: true } },
              offer: {
                include: {
                  identity: { include: { supplier: true, restaurant: true } },
                  evidence: true,
                  dish: { include: { cuisine: true } },
                },
              },
            },
          });
          if (!result)
            throw new AppError(
              404,
              "RECOMMENDATION_NOT_FOUND",
              "Không tìm thấy kết quả gợi ý của bạn",
            );
          const idempotencyKey = `${userId}:${body.idempotencyKey}`;
          const previous = await tx.userInteraction.findUnique({ where: { idempotencyKey } });
          if (previous) {
            if (
              previous.recommendationResultId !== result.id ||
              previous.interactionType !== body.type ||
              previous.rating !== (body.rating ?? null) ||
              (body.eatenAt && +previous.createdAt !== +createdAt)
            )
              throw new AppError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "Mã thao tác đã dùng cho phản hồi khác",
              );
            return previous;
          }
          if (body.type === "CHOSEN") {
            const offer = result.offer,
              supplier = offer?.identity.supplier;
            if (
              !offer ||
              !supplier?.enabled ||
              !offer.active ||
              !offer.moderationEnabled ||
              !offer.identity.restaurant.isActive ||
              !offer.dish?.isActive ||
              !offer.dish.cuisine.isActive ||
              !offer.isAvailable ||
              offer.mappingStatus !== "APPROVED" ||
              offer.dishId !== result.dishId ||
              (result.request.budgetMax !== null && offer.price > result.request.budgetMax) ||
              ["PERMANENTLY_CLOSED", "TEMPORARILY_CLOSED"].includes(
                offer.identity.restaurant.businessStatus,
              ) ||
              offer.expiresAt <= now ||
              offer.observedAt > now ||
              +now - +offer.observedAt > supplier.maxEvidenceAgeHours * 3600000 ||
              +offer.expiresAt - +offer.observedAt > supplier.maxEvidenceAgeHours * 3600000
            )
              throw new AppError(
                409,
                "OFFER_NO_LONGER_ELIGIBLE",
                "Thông tin món đã thay đổi hoặc hết hạn; hãy tìm lại trước khi xác nhận",
              );
            const [allergies, diets, note] = await Promise.all([
              tx.userAllergy.findMany({ where: { userId }, include: { allergen: true } }),
              tx.userDietaryRestriction.findMany({
                where: { userId, isMandatory: true },
                include: { dietaryRestriction: true },
              }),
              tx.personalFoodKnowledge.findUnique({ where: { userId } }),
            ]);
            if (
              (note && note.analyzedRevision !== note.revision) ||
              !safetyDecision(
                offer.evidence.filter(
                  (fact) =>
                    +now - +fact.observedAt <= supplier.maxEvidenceAgeHours * 3600000 &&
                    +fact.expiresAt - +fact.observedAt <= supplier.maxEvidenceAgeHours * 3600000,
                ),
                {
                  allergies: allergies.map((item) => item.allergen.code),
                  diets: diets.map((item) => item.dietaryRestriction.code),
                },
                now,
                offer.observedAt,
              ).eligible
            )
              throw new AppError(
                409,
                "OFFER_NO_LONGER_ELIGIBLE",
                "Ràng buộc ăn uống đã thay đổi hoặc chưa đủ bằng chứng; hãy tìm lại",
              );
          }
          return tx.userInteraction.create({
            data: {
              userId,
              dishId: result.dishId,
              restaurantId: result.restaurantId,
              recommendationResultId: result.id,
              interactionType: body.type,
              rating: body.rating ?? null,
              createdAt,
              idempotencyKey,
            },
          });
        },
        true,
      );
      return { data: { ...data, eligibleAgainAt: new Date(+data.createdAt + REPEAT_WINDOW_MS) } };
    },
  );
  app.get("/users/me/discovery-settings", async (request) => ({
    data: {
      settings: await app.prisma.discoverySettings.findUnique({
        where: { userId: request.authUser!.id },
        omit: { userId: true },
      }),
    },
  }));
  app.put(
    "/users/me/discovery-settings",
    {
      schema: {
        body: Type.Object(
          {
            budget: Type.Integer({ minimum: 1000, maximum: 100000000 }),
            radius: Type.Integer({ minimum: 3000, maximum: 4000 }),
            onlyOpen: Type.Boolean(),
            latitude: Type.Optional(
              Type.Union([Type.Number({ minimum: -90, maximum: 90 }), Type.Null()]),
            ),
            longitude: Type.Optional(
              Type.Union([Type.Number({ minimum: -180, maximum: 180 }), Type.Null()]),
            ),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      if (
        (request.body.latitude == null) !== (request.body.longitude == null) ||
        (request.body.latitude === undefined) !== (request.body.longitude === undefined)
      )
        throw new AppError(400, "INVALID_LOCATION", "Cần cả vĩ độ và kinh độ");
      const settings = await app.prisma.discoverySettings.upsert({
        where: { userId: request.authUser!.id },
        create: { userId: request.authUser!.id, ...request.body },
        update: request.body,
        omit: { userId: true },
      });
      return { data: { settings } };
    },
  );
  app.post(
    "/recommendations",
    {
      preHandler: createRateLimitHook({
        keyPrefix: "recommendation-create",
        limit: 15,
        windowMs: 60000,
      }),
      schema: {
        body: Type.Object(
          {
            idempotencyKey: Type.String({ format: "uuid" }),
            budget: Type.Optional(Type.Integer({ minimum: 1000, maximum: 100000000 })),
            radius: Type.Optional(Type.Integer({ minimum: 3000, maximum: 4000 })),
            latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
            longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
            onlyOpen: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      if ((request.body.latitude === undefined) !== (request.body.longitude === undefined))
        throw new AppError(400, "INVALID_LOCATION", "Cần cả vĩ độ và kinh độ");
      return { data: await service.recommend(request.authUser!.id, request.body) };
    },
  );
  app.get(
    "/recommendations/:id",
    {
      schema: {
        params: Type.Object(
          { id: Type.String({ format: "uuid" }) },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => ({ data: await service.get(request.authUser!.id, request.params.id) }),
  );
};
