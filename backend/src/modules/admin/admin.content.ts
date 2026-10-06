import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { audit } from "./admin.audit.js";

const Kind = Type.Union([
  Type.Literal("dishes"),
  Type.Literal("cuisines"),
  Type.Literal("ingredients"),
  Type.Literal("restaurants"),
  Type.Literal("offers"),
]);
type Kind = "dishes" | "cuisines" | "ingredients" | "restaurants" | "offers";
type Db = PrismaClient | Prisma.TransactionClient;
const Params = Type.Object(
  { kind: Kind, id: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);
const selected = { id: true, name: true, isActive: true, updatedAt: true } as const;
const missing = () =>
  new AppError(404, "CONTENT_NOT_FOUND", "Danh mục không còn tồn tại. Tải lại danh sách.");
const conflict = () =>
  new AppError(409, "CONTENT_CHANGED", "Dữ liệu đã thay đổi. Tải lại trước khi xác nhận.");
async function detail(db: Db, kind: Kind, id: string) {
  if (kind === "offers") {
    const row = await db.externalMenuItem.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        moderationEnabled: true,
        updatedAt: true,
        price: true,
        currency: true,
        active: true,
        isAvailable: true,
        expiresAt: true,
        identity: {
          select: {
            supplier: { select: { name: true } },
            restaurant: { select: { name: true, isActive: true } },
          },
        },
      },
    });
    return row
      ? {
          id: row.id,
          name: row.title,
          isActive: row.moderationEnabled,
          updatedAt: row.updatedAt,
          sourceActive: row.active && row.isAvailable,
          price: row.price,
          currency: row.currency,
          expiresAt: row.expiresAt,
          supplier: row.identity.supplier.name,
          restaurant: row.identity.restaurant.name,
        }
      : null;
  }
  if (kind === "dishes")
    return db.dish.findUnique({
      where: { id },
      select: {
        ...selected,
        description: true,
        slug: true,
        cuisine: { select: { name: true, isActive: true } },
        _count: { select: { interactions: true, externalOffers: true } },
      },
    });
  if (kind === "restaurants")
    return db.restaurant.findUnique({
      where: { id },
      select: {
        ...selected,
        address: true,
        businessStatus: true,
        _count: { select: { interactions: true, externalIdentities: true } },
      },
    });
  if (kind === "cuisines")
    return db.cuisine.findUnique({
      where: { id },
      select: {
        ...selected,
        code: true,
        description: true,
        _count: { select: { dishes: true, users: true } },
      },
    });
  return db.ingredient.findUnique({
    where: { id },
    select: { ...selected, code: true, description: true, _count: { select: { dishes: true } } },
  });
}
async function list(db: Db, kind: Kind, page: number, limit: number, q?: string, active?: boolean) {
  const search = q?.trim(),
    pagination = { skip: (page - 1) * limit, take: limit, orderBy: { id: "asc" as const } };
  if (kind === "offers") {
    const where = {
      ...(active === undefined ? {} : { moderationEnabled: active }),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      db.externalMenuItem.findMany({
        where,
        ...pagination,
        select: {
          id: true,
          title: true,
          moderationEnabled: true,
          updatedAt: true,
          active: true,
          isAvailable: true,
          price: true,
          currency: true,
          expiresAt: true,
        },
      }),
      db.externalMenuItem.count({ where }),
    ]);
    return {
      items: rows.map(({ title, moderationEnabled, active, isAvailable, ...row }) => ({
        ...row,
        name: title,
        isActive: moderationEnabled,
        sourceActive: active && isAvailable,
      })),
      total,
    };
  }
  const where = {
    ...(active === undefined ? {} : { isActive: active }),
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
  };
  if (kind === "dishes") {
    const [items, total] = await Promise.all([
      db.dish.findMany({
        where,
        ...pagination,
        select: { ...selected, slug: true, description: true },
      }),
      db.dish.count({ where }),
    ]);
    return { items, total };
  }
  if (kind === "restaurants") {
    const [items, total] = await Promise.all([
      db.restaurant.findMany({
        where,
        ...pagination,
        select: { ...selected, address: true, businessStatus: true },
      }),
      db.restaurant.count({ where }),
    ]);
    return { items, total };
  }
  if (kind === "cuisines") {
    const [items, total] = await Promise.all([
      db.cuisine.findMany({
        where,
        ...pagination,
        select: { ...selected, code: true, description: true },
      }),
      db.cuisine.count({ where }),
    ]);
    return { items, total };
  }
  const [items, total] = await Promise.all([
    db.ingredient.findMany({
      where,
      ...pagination,
      select: { ...selected, code: true, description: true },
    }),
    db.ingredient.count({ where }),
  ]);
  return { items, total };
}
async function requireActor(db: Db, id: string) {
  if (
    !(await db.user.findFirst({
      where: { id, status: "ACTIVE", role: "ADMIN" },
      select: { id: true },
    }))
  )
    throw new AppError(403, "FORBIDDEN", "Không còn quyền quản trị.");
}
export const adminContentRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRoles("ADMIN"));
  app.addHook(
    "preHandler",
    createRateLimitHook({ keyPrefix: "admin-content", limit: 60, windowMs: 60000 }),
  );
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.get(
    "/admin/content/:kind",
    {
      schema: {
        params: Type.Object({ kind: Kind }, { additionalProperties: false }),
        querystring: Type.Object(
          {
            page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000, default: 1 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
            q: Type.Optional(Type.String({ maxLength: 100 })),
            active: Type.Optional(Type.Boolean()),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const { page = 1, limit = 20, q, active } = req.query;
      return {
        data: { ...(await list(app.prisma, req.params.kind, page, limit, q, active)), page, limit },
      };
    },
  );
  app.get("/admin/content/:kind/:id", { schema: { params: Params } }, async (req) => {
    const row = await detail(app.prisma, req.params.kind, req.params.id);
    if (!row) throw missing();
    return { data: row };
  });
  app.put(
    "/admin/content/:kind/:id/status",
    {
      schema: {
        params: Params,
        body: Type.Object(
          {
            isActive: Type.Boolean(),
            expectedUpdatedAt: Type.String({ format: "date-time" }),
            confirm: Type.Literal(true),
            reasonCode: Type.Union([
              Type.Literal("DATA_REVIEW"),
              Type.Literal("DUPLICATE"),
              Type.Literal("SOURCE_REVIEW"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) =>
      serializableWrite(app.prisma, async (tx) => {
        await requireActor(tx, req.authUser!.id);
        const { kind, id } = req.params,
          current = await detail(tx, kind, id);
        if (!current) throw missing();
        const where = { id, updatedAt: new Date(req.body.expectedUpdatedAt) },
          updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
          data = { isActive: req.body.isActive, updatedAt };
        const result =
          kind === "dishes"
            ? await tx.dish.updateMany({ where, data })
            : kind === "cuisines"
              ? await tx.cuisine.updateMany({ where, data })
              : kind === "ingredients"
                ? await tx.ingredient.updateMany({ where, data })
                : kind === "restaurants"
                  ? await tx.restaurant.updateMany({ where, data })
                  : await tx.externalMenuItem.updateMany({
                      where,
                      data: { moderationEnabled: data.isActive, updatedAt },
                    });
        if (!result.count) throw conflict();
        await audit(tx, req.authUser!.id, "CONTENT_STATUS_REVIEW", id, {
          kind,
          from: current.isActive,
          to: req.body.isActive,
          reasonCode: req.body.reasonCode,
        });
        return { data: await detail(tx, kind, id) };
      }),
  );
  app.put(
    "/admin/content/:kind/:id/label",
    {
      schema: {
        params: Params,
        body: Type.Object(
          {
            name: Type.String({ minLength: 2, maxLength: 200 }),
            description: Type.Optional(Type.String({ maxLength: 3000 })),
            expectedUpdatedAt: Type.String({ format: "date-time" }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) =>
      serializableWrite(app.prisma, async (tx) => {
        await requireActor(tx, req.authUser!.id);
        const { kind, id } = req.params,
          name = req.body.name.trim();
        if (kind === "offers")
          throw new AppError(
            400,
            "SOURCE_MANAGED_CONTENT",
            "Tên, giá và tình trạng món được cập nhật từ nhà cung cấp. Chỉ quản lý trạng thái kiểm duyệt ở đây.",
          );
        if (kind === "restaurants" && req.body.description !== undefined)
          throw new AppError(
            400,
            "SOURCE_MANAGED_CONTENT",
            "Địa chỉ và thông tin quán được cập nhật từ nhà cung cấp.",
          );
        if (
          name.length < 2 ||
          name.length > (kind === "cuisines" ? 100 : kind === "restaurants" ? 200 : 150)
        )
          throw new AppError(400, "INVALID_NAME", "Tên danh mục vượt giới hạn hoặc quá ngắn.");
        const current = await detail(tx, kind, id);
        if (!current) throw missing();
        const where = { id, updatedAt: new Date(req.body.expectedUpdatedAt) },
          updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
          data = {
            name,
            ...(req.body.description !== undefined ? { description: req.body.description } : {}),
            updatedAt,
          };
        const changed =
          kind === "dishes"
            ? await tx.dish.updateMany({ where, data })
            : kind === "cuisines"
              ? await tx.cuisine.updateMany({ where, data })
              : kind === "ingredients"
                ? await tx.ingredient.updateMany({ where, data })
                : await tx.restaurant.updateMany({ where, data: { name, updatedAt } });
        if (!changed.count) throw conflict();
        await audit(tx, req.authUser!.id, "CONTENT_LABEL_UPDATED", id, { kind });
        return { data: await detail(tx, kind, id) };
      }),
  );
  app.post(
    "/admin/content/:kind",
    {
      schema: {
        params: Type.Object(
          { kind: Type.Union([Type.Literal("cuisines"), Type.Literal("ingredients")]) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            code: Type.String({ pattern: "^[A-Z][A-Z0-9_]{1,49}$" }),
            name: Type.String({ minLength: 2, maxLength: 150 }),
            description: Type.Optional(Type.String({ maxLength: 3000 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req, reply) => {
      const name = req.body.name.trim();
      if (name.length < 2 || (req.params.kind === "cuisines" && name.length > 100))
        throw new AppError(400, "INVALID_NAME", "Tên danh mục không hợp lệ.");
      try {
        const row = await serializableWrite(app.prisma, async (tx) => {
          await requireActor(tx, req.authUser!.id);
          const data = { ...req.body, name },
            row =
              req.params.kind === "cuisines"
                ? await tx.cuisine.create({ data })
                : await tx.ingredient.create({ data });
          await audit(tx, req.authUser!.id, "CATALOG_CREATED", row.id, { kind: req.params.kind });
          return row;
        });
        return reply.status(201).send({ data: row });
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002")
          throw new AppError(
            409,
            "CATALOG_CODE_EXISTS",
            "Mã danh mục đã tồn tại. Tìm kiếm trước khi tạo lại.",
          );
        throw error;
      }
    },
  );
};
