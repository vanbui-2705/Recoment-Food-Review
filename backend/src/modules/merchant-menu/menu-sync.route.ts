import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { audit } from "../admin/admin.audit.js";
import { menuAdapters, menuSyncEnabled, type MenuAdapterRegistry } from "./menu-sync.adapters.js";
const Params = Type.Object(
  { id: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);
const jobSelect = {
  id: true,
  scheduleId: true,
  status: true,
  attempts: true,
  errorCode: true,
  retryable: true,
  runId: true,
  availableAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
const conflict = () =>
  new AppError(
    409,
    "MENU_SYNC_CHANGED",
    "Trạng thái đồng bộ đã thay đổi. Tải lại trước khi xác nhận.",
  );
export function createMenuSyncRoutes(
  adapters: MenuAdapterRegistry = menuAdapters,
  enabled = menuSyncEnabled(),
): FastifyPluginAsyncTypebox {
  return async (app) => {
    app.addHook("preHandler", app.authenticate);
    app.addHook("preHandler", app.requireRoles("ADMIN"));
    app.addHook(
      "preHandler",
      createRateLimitHook({ keyPrefix: "menu-sync-admin", limit: 30, windowMs: 60000 }),
    );
    app.addHook("onSend", async (_req, reply) => {
      reply.header("Cache-Control", "no-store");
    });
    async function actor(tx: Parameters<Parameters<typeof serializableWrite>[1]>[0], id: string) {
      if (
        !(await tx.user.findFirst({
          where: { id, role: "ADMIN", status: "ACTIVE" },
          select: { id: true },
        }))
      )
        throw new AppError(403, "FORBIDDEN", "Không còn quyền quản trị.");
    }
    async function usable(
      tx: Parameters<Parameters<typeof serializableWrite>[1]>[0],
      supplierId: string,
    ) {
      const row = await tx.menuSyncSchedule.findUnique({
        where: { supplierId },
        include: { supplier: { select: { enabled: true } } },
      });
      if (!row)
        throw new AppError(404, "MENU_SYNC_NOT_FOUND", "Chưa có lịch đồng bộ cho nguồn này.");
      if (!enabled || !adapters.get(row.adapterCode)?.configured)
        throw new AppError(
          503,
          "MENU_SYNC_NOT_CONFIGURED",
          "Chưa kết nối adapter thực đơn hoặc worker đồng bộ chưa được bật.",
        );
      if (!row.enabled || !row.supplier.enabled)
        throw new AppError(409, "MENU_SYNC_PAUSED", "Nguồn hoặc lịch đồng bộ đang tạm ngừng.");
      return row;
    }
    app.get("/admin/menu/schedules", async () => ({
      data: {
        workerEnabled: enabled,
        adapters: [...adapters].filter(([, value]) => value.configured).map(([code]) => ({ code })),
        items: await app.prisma.menuSyncSchedule.findMany({
          select: {
            supplierId: true,
            adapterCode: true,
            enabled: true,
            intervalMinutes: true,
            nextRunAt: true,
            updatedAt: true,
            supplier: { select: { name: true, enabled: true } },
          },
          orderBy: { supplierId: "asc" },
          take: 100,
        }),
      },
    }));
    app.put(
      "/admin/menu/schedules/:id",
      {
        schema: {
          params: Params,
          body: Type.Object(
            {
              adapterCode: Type.String({ pattern: "^[a-z][a-z0-9-]{1,49}$" }),
              enabled: Type.Boolean(),
              intervalMinutes: Type.Integer({ minimum: 5, maximum: 1440 }),
              expectedUpdatedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (req) =>
        serializableWrite(app.prisma, async (tx) => {
          await actor(tx, req.authUser!.id);
          if (!adapters.get(req.body.adapterCode)?.configured || (req.body.enabled && !enabled))
            throw new AppError(
              503,
              "MENU_SYNC_NOT_CONFIGURED",
              "Chưa kết nối adapter thực đơn hoặc worker đồng bộ chưa được bật.",
            );
          const supplier = await tx.merchantSupplier.findUnique({ where: { id: req.params.id } });
          if (!supplier)
            throw new AppError(404, "SUPPLIER_NOT_FOUND", "Không tìm thấy nguồn thực đơn.");
          const previous = await tx.menuSyncSchedule.findUnique({
            where: { supplierId: req.params.id },
          });
          if (
            (previous?.updatedAt.toISOString() ?? null) !==
            (req.body.expectedUpdatedAt ? new Date(req.body.expectedUpdatedAt).toISOString() : null)
          )
            throw conflict();
          if (previous && previous.adapterCode !== req.body.adapterCode)
            throw new AppError(
              409,
              "MENU_SYNC_SOURCE_BOUND",
              "Adapter của nguồn đã được cố định. Nguồn mới cần định danh riêng.",
            );
          const data = {
            adapterCode: req.body.adapterCode,
            enabled: req.body.enabled,
            intervalMinutes: req.body.intervalMinutes,
            nextRunAt: new Date(),
            updatedAt: new Date(Math.max(Date.now(), (previous?.updatedAt.getTime() ?? 0) + 1)),
          };
          const row = await tx.menuSyncSchedule.upsert({
            where: { supplierId: supplier.id },
            create: { supplierId: supplier.id, ...data },
            update: data,
          });
          await audit(tx, req.authUser!.id, "MENU_SCHEDULE_UPDATED", supplier.id, {
            enabled: row.enabled,
            intervalMinutes: row.intervalMinutes,
          });
          return { data: row };
        }),
    );
    app.post(
      "/admin/menu/schedules/:id/run",
      {
        schema: {
          params: Params,
          body: Type.Object(
            { idempotencyKey: Type.String({ format: "uuid" }), confirm: Type.Literal(true) },
            { additionalProperties: false },
          ),
        },
      },
      async (req, reply) => {
        const data = await serializableWrite(
          app.prisma,
          async (tx) => {
            await actor(tx, req.authUser!.id);
            await usable(tx, req.params.id);
            const key = `manual:${req.params.id}:${req.body.idempotencyKey}`,
              previous = await tx.menuSyncJob.findUnique({
                where: { idempotencyKey: key },
                select: jobSelect,
              });
            if (previous) return previous;
            const row = await tx.menuSyncJob.create({
              data: { scheduleId: req.params.id, idempotencyKey: key },
              select: jobSelect,
            });
            await audit(tx, req.authUser!.id, "MENU_SYNC_REQUESTED", row.id);
            return row;
          },
          true,
        );
        return reply.status(202).send({ data });
      },
    );
    app.get(
      "/admin/menu/sync-jobs",
      {
        schema: {
          querystring: Type.Object(
            {
              page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
              limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (req) => {
        const page = req.query.page ?? 1,
          limit = req.query.limit ?? 20;
        const [items, total] = await Promise.all([
          app.prisma.menuSyncJob.findMany({
            select: {
              ...jobSelect,
              schedule: { select: { supplier: { select: { name: true } } } },
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit,
            skip: (page - 1) * limit,
          }),
          app.prisma.menuSyncJob.count(),
        ]);
        return { data: { items, total, page, limit } };
      },
    );
    app.get("/admin/menu/sync-jobs/:id", { schema: { params: Params } }, async (req) => {
      const row = await app.prisma.menuSyncJob.findUnique({
        where: { id: req.params.id },
        select: { ...jobSelect, schedule: { select: { supplier: { select: { name: true } } } } },
      });
      if (!row) throw new AppError(404, "MENU_SYNC_NOT_FOUND", "Không tìm thấy lượt đồng bộ.");
      return { data: row };
    });
    app.post(
      "/admin/menu/sync-jobs/:id/retry",
      {
        schema: {
          params: Params,
          body: Type.Object(
            {
              confirm: Type.Literal(true),
              expectedUpdatedAt: Type.String({ format: "date-time" }),
            },
            { additionalProperties: false },
          ),
        },
      },
      async (req) =>
        serializableWrite(app.prisma, async (tx) => {
          await actor(tx, req.authUser!.id);
          const previous = await tx.menuSyncJob.findUnique({ where: { id: req.params.id } });
          if (!previous)
            throw new AppError(404, "MENU_SYNC_NOT_FOUND", "Không tìm thấy lượt đồng bộ.");
          await usable(tx, previous.scheduleId);
          if (
            previous.status !== "FAILED" ||
            !previous.retryable ||
            previous.updatedAt.toISOString() !== new Date(req.body.expectedUpdatedAt).toISOString()
          )
            throw conflict();
          const changed = await tx.menuSyncJob.updateMany({
            where: { id: previous.id, status: "FAILED", updatedAt: previous.updatedAt },
            data: {
              status: "QUEUED",
              attempts: 0,
              errorCode: null,
              availableAt: new Date(),
              leaseToken: null,
              leaseUntil: null,
              updatedAt: new Date(Math.max(Date.now(), +previous.updatedAt + 1)),
            },
          });
          if (!changed.count) throw conflict();
          await audit(tx, req.authUser!.id, "MENU_SYNC_RETRY", previous.id);
          return {
            data: await tx.menuSyncJob.findUniqueOrThrow({
              where: { id: previous.id },
              select: jobSelect,
            }),
          };
        }),
    );
  };
}
