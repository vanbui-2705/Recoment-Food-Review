import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { AppError } from "../../common/errors/app-error.js";
import { createDiscoveryService } from "./discovery.service.js";
import { createNearbyFoodService } from "./nearby-food.service.js";
const RecipeSourceSchema = Type.Union([Type.Literal("themealdb"), Type.Literal("spoonacular")]);
const PlaceSourceSchema = Type.Union([
  Type.Literal("google"),
  Type.Literal("goong"),
  Type.Literal("foursquare"),
  Type.Literal("geoapify"),
]);
const RecipeParams = Type.Object(
  { source: RecipeSourceSchema, id: Type.String({ pattern: "^[0-9]{1,20}$" }) },
  { additionalProperties: false },
);
export const discoveryRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = createDiscoveryService(app.prisma);
  const nearby = createNearbyFoodService(app.prisma);
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  app.addHook("preHandler", app.authenticate);
  app.addHook(
    "preHandler",
    createRateLimitHook({ keyPrefix: "external-discovery", limit: 15, windowMs: 60000 }),
  );
  app.get("/discovery/sources", async () => ({ data: { items: service.sources() } }));
  app.get(
    "/discovery/nearby-food",
    {
      schema: {
        querystring: Type.Object(
          {
            budget: Type.Integer({ minimum: 1000, maximum: 100000000 }),
            latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
            longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
            radius: Type.Optional(Type.Integer({ minimum: 3000, maximum: 4000 })),
            onlyOpen: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const { latitude, longitude } = req.query;
      if ((latitude === undefined) !== (longitude === undefined))
        throw new AppError(400, "INVALID_LOCATION", "Cần cả vĩ độ và kinh độ");
      return {
        data: await nearby.search(
          req.authUser!.id,
          req.query.budget,
          latitude === undefined ? undefined : { latitude, longitude: longitude! },
          req.query.radius,
          undefined,
          req.query.onlyOpen,
        ),
      };
    },
  );
  app.get(
    "/discovery/restaurants",
    {
      schema: {
        querystring: Type.Object(
          {
            q: Type.String({ minLength: 1, maxLength: 150 }),
            source: Type.Optional(PlaceSourceSchema),
            latitude: Type.Optional(Type.Number({ minimum: -90, maximum: 90 })),
            longitude: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
            radius: Type.Optional(Type.Integer({ minimum: 100, maximum: 50000 })),
            openNow: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const { q, source, latitude, longitude, radius, openNow } = req.query;
      if (!q.trim()) throw new AppError(400, "INVALID_QUERY", "Nhập tên món hoặc tên quán");
      if ((latitude === undefined) !== (longitude === undefined))
        throw new AppError(400, "INVALID_LOCATION", "Cần cả vĩ độ và kinh độ");
      return {
        data: await service.restaurants(
          req.authUser!.id,
          q.trim(),
          source,
          latitude === undefined ? undefined : { latitude, longitude: longitude! },
          radius,
          openNow,
        ),
      };
    },
  );
  app.get(
    "/recipes",
    {
      schema: {
        querystring: Type.Object(
          {
            q: Type.String({ minLength: 1, maxLength: 150 }),
            source: Type.Optional(RecipeSourceSchema),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      if (!req.query.q.trim()) throw new AppError(400, "INVALID_QUERY", "Nhập tên món cần nấu");
      return { data: await service.searchRecipes(req.query.q.trim(), req.query.source) };
    },
  );
  app.get("/recipes/today", async (req) => ({ data: await service.today(req.authUser!.id) }));
  app.get("/recipes/:source/:id", { schema: { params: RecipeParams } }, async (req) => ({
    data: { recipe: await service.detail(req.params.source, req.params.id) },
  }));
  app.post(
    "/recipes/:source/:id/interactions",
    {
      schema: {
        params: RecipeParams,
        body: Type.Object(
          {
            type: Type.Union([Type.Literal("CHOSEN"), Type.Literal("EATEN")]),
            idempotencyKey: Type.String({ format: "uuid" }),
            eatenAt: Type.Optional(Type.String({ format: "date-time" })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => ({
      data: await service.record(
        req.authUser!.id,
        req.params.source,
        req.params.id,
        req.body.type,
        req.body.idempotencyKey,
        req.body.eatenAt,
      ),
    }),
  );
  app.get("/users/me/recipe-history", async (req) => ({
    data: {
      items: await app.prisma.recipeInteraction.findMany({
        where: { userId: req.authUser!.id, interactionType: { in: ["CHOSEN", "EATEN"] } },
        select: {
          id: true,
          source: true,
          recipeId: true,
          title: true,
          interactionType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    },
  }));
};
