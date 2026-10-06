import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { audit } from "./admin.audit.js";

export function assertAdminRemains(
  role: string,
  status: string,
  nextStatus: string,
  activeAdmins: number,
) {
  if (role === "ADMIN" && status === "ACTIVE" && nextStatus === "DISABLED" && activeAdmins <= 1)
    throw new AppError(
      409,
      "LAST_ACTIVE_ADMIN",
      "Không thể khóa quản trị viên đang hoạt động cuối cùng.",
    );
}
const selected = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
export const adminUserRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRoles("ADMIN"));
  app.addHook(
    "preHandler",
    createRateLimitHook({ keyPrefix: "admin-users", limit: 60, windowMs: 60_000 }),
  );
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.get(
    "/admin/users",
    {
      schema: {
        querystring: Type.Object(
          {
            page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000, default: 1 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
            q: Type.Optional(Type.String({ maxLength: 100 })),
            status: Type.Optional(Type.Union([Type.Literal("ACTIVE"), Type.Literal("DISABLED")])),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const { page = 1, limit = 20, q, status } = req.query;
      const search = q?.trim();
      const where = {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: "insensitive" as const } },
                { displayName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };
      const [items, total] = await app.prisma.$transaction([
        app.prisma.user.findMany({
          where,
          select: selected,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        app.prisma.user.count({ where }),
      ]);
      return { data: { items, total, page, limit, currentUserId: req.authUser!.id } };
    },
  );
  app.get(
    "/admin/users/:id",
    {
      schema: {
        params: Type.Object(
          { id: Type.String({ format: "uuid" }) },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const user = await app.prisma.user.findUnique({
        where: { id: req.params.id },
        select: selected,
      });
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
      return { data: user };
    },
  );
  app.put(
    "/admin/users/:id/status",
    {
      schema: {
        params: Type.Object(
          { id: Type.String({ format: "uuid" }) },
          { additionalProperties: false },
        ),
        body: Type.Object(
          {
            status: Type.Union([Type.Literal("ACTIVE"), Type.Literal("DISABLED")]),
            expectedUpdatedAt: Type.String({ format: "date-time" }),
            reasonCode: Type.Union([
              Type.Literal("ABUSE"),
              Type.Literal("SECURITY"),
              Type.Literal("USER_REQUEST"),
              Type.Literal("REVIEW_COMPLETE"),
            ]),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      return {
        data: await serializableWrite(app.prisma, async (tx) => {
          // All account moderation uses this lock; never race the last-admin count against another moderation.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('rec-food-admin-access'))::text`;
          const actor = await tx.user.findUnique({
            where: { id: req.authUser!.id },
            select: { status: true, role: true },
          });
          if (!actor || actor.status !== "ACTIVE" || actor.role !== "ADMIN")
            throw new AppError(403, "FORBIDDEN", "Bạn không còn quyền quản trị.");
          const target = await tx.user.findUnique({
            where: { id: req.params.id },
            select: selected,
          });
          if (!target) throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy tài khoản.");
          if (target.updatedAt.getTime() !== new Date(req.body.expectedUpdatedAt).getTime())
            throw new AppError(
              409,
              "USER_STATUS_CHANGED",
              "Trạng thái tài khoản đã thay đổi. Tải lại trước khi xử lý.",
            );
          if (target.status === req.body.status) return target;
          assertAdminRemains(
            target.role,
            target.status,
            req.body.status,
            await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
          );
          const updated = await tx.user.update({
            where: { id: target.id },
            data: {
              status: req.body.status,
              authVersion: { increment: 1 },
              updatedAt: new Date(Math.max(Date.now(), target.updatedAt.getTime() + 1)),
            },
            select: selected,
          });
          await tx.refreshToken.updateMany({
            where: { userId: target.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await audit(tx, req.authUser!.id, "USER_STATUS_REVIEW", target.id, {
            from: target.status,
            to: updated.status,
            reasonCode: req.body.reasonCode,
          });
          return updated;
        }),
      };
    },
  );
  app.get(
    "/admin/audit",
    {
      schema: {
        querystring: Type.Object(
          {
            page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000, default: 1 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => {
      const { page = 1, limit = 20 } = req.query;
      const [items, total] = await app.prisma.$transaction([
        app.prisma.adminAudit.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            actorId: true,
            action: true,
            targetId: true,
            metadata: true,
            createdAt: true,
          },
        }),
        app.prisma.adminAudit.count(),
      ]);
      return { data: { items, total, page, limit } };
    },
  );
};
