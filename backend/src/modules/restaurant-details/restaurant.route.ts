import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { createRestaurantProviders } from "./restaurant.providers.js";
import { safetyDecision } from "../merchant-menu/safety.policy.js";
import { quotaFetch } from "../discovery/provider.quota.js";

export const restaurantRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook(
    "preHandler",
    createRateLimitHook({ keyPrefix: "restaurant-details", limit: 30, windowMs: 60000 }),
  );
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const providers = createRestaurantProviders(process.env, quotaFetch(app.prisma));
  const query = Type.Object(
    {
      cursor: Type.Optional(Type.String({ format: "uuid" })),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      budget: Type.Optional(Type.Integer({ minimum: 0, maximum: 100000000 })),
    },
    { additionalProperties: false },
  );
  const menu = async (
    restaurantId: string | null,
    userId: string,
    limit: number,
    cursor?: string,
    budget?: number,
  ) => {
    if (!restaurantId) return { items: [], nextCursor: null, status: "NO_MENU" };
    const now = new Date();
    const [allergies, diets] = await Promise.all([
      app.prisma.userAllergy.findMany({ where: { userId }, include: { allergen: true } }),
      app.prisma.userDietaryRestriction.findMany({
        where: { userId, isMandatory: true },
        include: { dietaryRestriction: true },
      }),
    ]);
    if (
      cursor &&
      !(await app.prisma.externalMenuItem.findFirst({
        where: { id: cursor, identity: { restaurantId } },
      }))
    )
      throw new AppError(400, "INVALID_CURSOR", "Trang thực đơn không hợp lệ");
    const rows = await app.prisma.externalMenuItem.findMany({
      where: {
        identity: { restaurantId, restaurant: { isActive: true }, supplier: { enabled: true } },
        active: true,
        moderationEnabled: true,
        OR: [{ dishId: null }, { dish: { isActive: true, cuisine: { isActive: true } } }],
      },
      include: { identity: { include: { supplier: true } }, evidence: true },
      orderBy: { id: "asc" },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit + 1,
    });
    return {
      status: rows.length ? "AVAILABLE" : "NO_MENU",
      nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
      items: rows.slice(0, limit).map((row) => {
        const fresh =
          row.expiresAt > now &&
          row.observedAt <= now &&
          +now - +row.observedAt <= row.identity.supplier.maxEvidenceAgeHours * 3600000;
        const constraints = {
          allergies: allergies.map((a) => a.allergen.code),
          diets: diets.map((d) => d.dietaryRestriction.code),
        };
        const policyFacts = row.evidence.filter(
          (fact) =>
            +now - +fact.observedAt <= row.identity.supplier.maxEvidenceAgeHours * 3600000 &&
            +fact.expiresAt - +fact.observedAt <=
              row.identity.supplier.maxEvidenceAgeHours * 3600000,
        );
        const safety = safetyDecision(policyFacts, constraints, now, row.observedAt);
        return {
          id: row.id,
          dishId: row.dishId,
          title: row.title,
          optionLabel: row.optionLabel,
          price: fresh ? row.price : null,
          currency: "VND",
          budgetVerified: fresh,
          withinBudget: fresh && budget !== undefined ? row.price <= budget : null,
          isAvailable: row.isAvailable,
          fresh,
          source: row.identity.supplier.name,
          sourceUrl: row.sourceUrl,
          observedAt: row.observedAt,
          expiresAt: row.expiresAt,
          safety:
            constraints.allergies.length || constraints.diets.length
              ? safety.eligible
                ? "CONSTRAINTS_CONFIRMED"
                : "UNCONFIRMED"
              : "NOT_ASSESSED",
          warnings: [
            ...(!fresh ? ["PRICE_EXPIRED"] : []),
            ...(!row.isAvailable ? ["UNAVAILABLE"] : []),
            ...(!row.dishId ? ["MAPPING_PENDING"] : []),
            ...safety.reasons,
          ],
        };
      }),
    };
  };
  app.get(
    "/restaurants/:id",
    {
      schema: {
        params: Type.Object(
          { id: Type.String({ format: "uuid" }) },
          { additionalProperties: false },
        ),
        querystring: query,
      },
    },
    async (req) => {
      const restaurant = await app.prisma.restaurant.findUnique({
        where: { id: req.params.id },
        include: {
          externalIdentities: { include: { supplier: { select: { name: true, enabled: true } } } },
        },
      });
      if (!restaurant) throw new AppError(404, "RESTAURANT_NOT_FOUND", "Không tìm thấy quán");
      return {
        data: {
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.address,
            latitude: Number(restaurant.latitude),
            longitude: Number(restaurant.longitude),
            source:
              restaurant.externalIdentities
                .filter((i) => i.supplier.enabled)
                .map((i) => i.supplier.name)
                .join(", ") || "Nguồn quán đã lưu",
            rating: null,
            ratingCount: null,
            phone: null,
            openNow: null,
            openingHours: [],
            photo: null,
            attributions: [],
            mediaKind: "VENUE",
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${restaurant.latitude},${restaurant.longitude}`,
            updatedAt: restaurant.updatedAt,
          },
          menu: await menu(
            restaurant.id,
            req.authUser!.id,
            req.query.limit ?? 20,
            req.query.cursor,
            req.query.budget,
          ),
        },
      };
    },
  );
  app.get(
    "/restaurants/places/:source/:externalId",
    {
      schema: {
        params: Type.Object(
          {
            source: Type.Union([
              Type.Literal("google"),
              Type.Literal("goong"),
              Type.Literal("foursquare"),
              Type.Literal("geoapify"),
            ]),
            externalId: Type.String({ pattern: "^[A-Za-z0-9:_-]{1,255}$" }),
          },
          { additionalProperties: false },
        ),
        querystring: query,
      },
    },
    async (req) => {
      const place = await providers.detail(req.params.source, req.params.externalId);
      // Only an existing explicit Google identity is trusted; never merge suppliers by restaurant name.
      const local =
        req.params.source === "google"
          ? await app.prisma.restaurant.findUnique({
              where: { googlePlaceId: req.params.externalId },
              select: { id: true },
            })
          : null;
      return {
        data: {
          restaurant: { ...place, id: local?.id ?? null },
          menu: await menu(
            local?.id ?? null,
            req.authUser!.id,
            req.query.limit ?? 20,
            req.query.cursor,
            req.query.budget,
          ),
        },
      };
    },
  );
};
