import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { createPlacesAdapter } from "../places/places.adapter.js";
import { createFoodRepository, dishInclude } from "./food.repository.js";
import { DishIdSchema, DishWriteSchema, normalizeFoodText } from "./food.schema.js";
import { createFoodService } from "./food.service.js";
export const foodRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const repository = createFoodRepository(app.prisma);
  const service = createFoodService(app.prisma);
  const places = createPlacesAdapter();
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const auth = { preHandler: app.authenticate };
  const params = { params: DishIdSchema };
  app.put(
    "/admin/ingredients/:code",
    {
      preHandler: [app.authenticate, app.requireRoles("ADMIN")],
      schema: {
        params: Type.Object(
          { code: Type.String({ minLength: 1, maxLength: 80, pattern: "^[A-Z0-9_]+$" }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            name: Type.String({ minLength: 1, maxLength: 150 }),
            description: Type.String({ maxLength: 3000 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const name = req.body.name.trim();
      if (!name) throw new AppError(400, "INVALID_NAME", "Tên nguyên liệu không được trống");
      return {
        data: {
          ingredient: await app.prisma.ingredient.upsert({
            where: { code: req.params.code },
            update: { name, description: req.body.description },
            create: { code: req.params.code, name, description: req.body.description },
          }),
        },
      };
    },
  );
  app.get("/catalogs/ingredients", auth, async () => ({
    data: { items: await app.prisma.ingredient.findMany({ orderBy: { code: "asc" }, take: 1000 }) },
  }));
  app.get(
    "/dishes",
    {
      ...auth,
      schema: {
        querystring: Type.Object(
          {
            q: Type.Optional(Type.String({ maxLength: 150 })),
            page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const q = req.query.q?.trim();
      const limit = req.query.limit ?? 20;
      const page = req.query.page ?? 1;
      const where = q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { aliases: { some: { normalizedAlias: { contains: normalizeFoodText(q) } } } },
            ],
          }
        : {};
      const [items, total] = await Promise.all([
        app.prisma.dish.findMany({
          where,
          include: dishInclude,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        app.prisma.dish.count({ where }),
      ]);
      return { data: { items, total, page, limit } };
    },
  );
  app.get("/dishes/:id", { ...auth, schema: params }, async (req) => {
    const dish = await app.prisma.dish.findUnique({
      where: { id: req.params.id },
      include: dishInclude,
    });
    if (!dish) throw new AppError(404, "DISH_NOT_FOUND", "Không tìm thấy món");
    return { data: { dish } };
  });
  app.post(
    "/admin/dishes",
    {
      preHandler: [app.authenticate, app.requireRoles("ADMIN")],
      schema: { body: DishWriteSchema },
    },
    async (req, reply) =>
      reply.code(201).send({ data: { dish: await repository.save(undefined, req.body) } }),
  );
  app.put(
    "/admin/dishes/:id",
    {
      preHandler: [app.authenticate, app.requireRoles("ADMIN")],
      schema: { ...params, body: DishWriteSchema },
    },
    async (req) => ({ data: { dish: await repository.save(req.params.id, req.body) } }),
  );
  app.put(
    "/users/me/dishes/:id/preference",
    {
      ...auth,
      schema: {
        ...params,
        body: Type.Object(
          {
            preference: Type.Union([Type.Literal("LIKED"), Type.Literal("DISLIKED"), Type.Null()]),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const userId = req.authUser!.id;
      const dishId = req.params.id;
      if (!(await app.prisma.dish.findUnique({ where: { id: dishId } })))
        throw new AppError(404, "DISH_NOT_FOUND", "Không tìm thấy món");
      if (!req.body.preference)
        await app.prisma.userDishPreference.deleteMany({ where: { userId, dishId } });
      else
        await app.prisma.userDishPreference.upsert({
          where: { userId_dishId: { userId, dishId } },
          update: { preference: req.body.preference },
          create: { userId, dishId, preference: req.body.preference },
        });
      return { data: { saved: true } };
    },
  );
  app.get("/users/me/dish-preferences", auth, async (req) => ({
    data: {
      items: await app.prisma.userDishPreference.findMany({
        where: { userId: req.authUser!.id },
        include: { dish: true },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
    },
  }));
  app.get("/recommendations/today", auth, async (req) => {
    const userId = req.authUser!.id;
    const [data, settings, profile, note] = await Promise.all([
      service.today(userId),
      app.prisma.discoverySettings.findUnique({ where: { userId } }),
      app.prisma.tasteProfile.findUnique({ where: { userId } }),
      app.prisma.personalFoodKnowledge.findUnique({ where: { userId } }),
    ]);
    return {
      data: {
        ...data,
        discoveryContext: {
          enabled: true,
          profileRevision: note?.revision ?? 0,
          personalizedReady: !["PROFILE_PENDING_ANALYSIS", "ONBOARDING_REQUIRED"].includes(
            data.status,
          ),
          budget: settings?.budget ?? profile?.budgetMax ?? 50000,
          radius:
            settings?.radius ?? Math.min(4000, Math.max(3000, profile?.maxDistanceMeters ?? 3500)),
          latitude: settings?.latitude ?? profile?.latitude ?? null,
          longitude: settings?.longitude ?? profile?.longitude ?? null,
          onlyOpen: settings?.onlyOpen ?? false,
        },
      },
    };
  });
  app.post(
    "/users/me/dishes/:id/interactions",
    {
      ...auth,
      schema: {
        ...params,
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
    async (req) => {
      if (req.body.type === "CHOSEN" && req.body.eatenAt)
        throw new AppError(400, "INVALID_EATEN_AT", "Thời điểm ăn chỉ áp dụng cho món đã ăn");
      return {
        data: await service.record(
          req.authUser!.id,
          req.params.id,
          req.body.type,
          req.body.idempotencyKey,
          req.body.eatenAt,
        ),
      };
    },
  );
  app.get("/users/me/food-history", auth, async (req) => ({
    data: {
      items: await app.prisma.userInteraction.findMany({
        where: { userId: req.authUser!.id, interactionType: { in: ["CHOSEN", "EATEN"] } },
        include: { dish: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    },
  }));
  app.get(
    "/dishes/:id/restaurants",
    {
      preHandler: [
        app.authenticate,
        createRateLimitHook({ keyPrefix: "places", limit: 10, windowMs: 60000 }),
      ],
      schema: params,
    },
    async (req) => {
      const [dish, profile] = await Promise.all([
        app.prisma.dish.findUnique({ where: { id: req.params.id } }),
        app.prisma.tasteProfile.findUnique({ where: { userId: req.authUser!.id } }),
      ]);
      if (!dish) throw new AppError(404, "DISH_NOT_FOUND", "Không tìm thấy món");
      if (profile?.latitude == null || profile.longitude == null)
        throw new AppError(
          400,
          "LOCATION_REQUIRED",
          "Hãy lưu vị trí trong hồ sơ trước khi tìm quán",
        );
      return {
        data: {
          items: await places.search(
            dish.name,
            { latitude: profile.latitude, longitude: profile.longitude },
            profile.maxDistanceMeters,
          ),
          source: "Google Maps",
          updatedAt: new Date().toISOString(),
          notice: "Kết quả tìm quán; chưa xác nhận thực đơn, giá món hoặc an toàn dị ứng.",
        },
      };
    },
  );
};
