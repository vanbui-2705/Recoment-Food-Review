import { createHash } from "node:crypto";
import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { audit } from "../admin/admin.audit.js";
const Status = Type.Union([
  Type.Literal("OPEN"),
  Type.Literal("IN_REVIEW"),
  Type.Literal("RESOLVED"),
  Type.Literal("DISMISSED"),
]);
const Target = Type.Union([
  Type.Object(
    { kind: Type.Literal("OFFER"), id: Type.String({ format: "uuid" }) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("PLACE"),
      source: Type.Union([
        Type.Literal("google"),
        Type.Literal("goong"),
        Type.Literal("foursquare"),
        Type.Literal("geoapify"),
      ]),
      id: Type.String({ pattern: "^[A-Za-z0-9:_-]{1,255}$" }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("RECIPE"),
      source: Type.Union([Type.Literal("themealdb"), Type.Literal("spoonacular")]),
      id: Type.String({ pattern: "^[0-9]{1,30}$" }),
    },
    { additionalProperties: false },
  ),
]);
const Params = Type.Object(
  { id: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);
const Listing = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    status: Type.Optional(Status),
  },
  { additionalProperties: false },
);
const ownerSelect = {
  id: true,
  targetKind: true,
  targetSource: true,
  targetId: true,
  reason: true,
  note: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
export const reportRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  app.post(
    "/users/me/data-reports",
    {
      preHandler: createRateLimitHook({ keyPrefix: "report-create", limit: 5, windowMs: 60000 }),
      schema: {
        body: Type.Object(
          {
            target: Target,
            reason: Type.Union([
              Type.Literal("WRONG_PRICE"),
              Type.Literal("UNAVAILABLE"),
              Type.Literal("WRONG_ADDRESS"),
              Type.Literal("INGREDIENTS"),
              Type.Literal("MEDIA"),
              Type.Literal("OTHER"),
            ]),
            note: Type.String({ minLength: 1, maxLength: 2000 }),
            idempotencyKey: Type.String({ format: "uuid" }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const userId = request.authUser!.id,
        body = request.body,
        note = body.note.trim();
      if (!note) throw new AppError(400, "INVALID_REPORT_NOTE", "Mô tả thông tin cần kiểm tra");
      const targetSource = "source" in body.target ? body.target.source : null;
      const inputHash = createHash("sha256")
        .update(
          JSON.stringify({
            kind: body.target.kind,
            source: targetSource,
            id: body.target.id,
            reason: body.reason,
            note,
          }),
        )
        .digest("hex");
      const data = await serializableWrite(
        app.prisma,
        async (tx) => {
          const idempotencyKey = `${userId}:${body.idempotencyKey}`;
          const previous = await tx.dataReport.findUnique({
            where: { idempotencyKey },
            select: { ...ownerSelect, inputHash: true },
          });
          if (previous) {
            if (previous.inputHash !== inputHash)
              throw new AppError(409, "IDEMPOTENCY_CONFLICT", "Mã gửi đã dùng cho báo cáo khác");
            const { inputHash: _hash, ...result } = previous;
            void _hash;
            return result;
          }
          if (
            body.target.kind === "OFFER" &&
            !(await tx.externalMenuItem.count({ where: { id: body.target.id } }))
          )
            throw new AppError(404, "REPORT_TARGET_NOT_FOUND", "Không tìm thấy món cần báo cáo");
          return tx.dataReport.create({
            data: {
              userId,
              targetKind: body.target.kind,
              targetSource,
              targetId: body.target.id,
              reason: body.reason,
              note,
              idempotencyKey,
              inputHash,
            },
            select: ownerSelect,
          });
        },
        true,
      );
      return { data };
    },
  );
  app.get("/users/me/data-reports", { schema: { querystring: Listing } }, async (request) => {
    const limit = request.query.limit ?? 20,
      page = request.query.page ?? 1;
    const where = {
      userId: request.authUser!.id,
      ...(request.query.status ? { status: request.query.status } : {}),
    };
    const [items, total] = await Promise.all([
      app.prisma.dataReport.findMany({
        where,
        select: ownerSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.dataReport.count({ where }),
    ]);
    return { data: { items, total, page, limit } };
  });
  app.get("/users/me/data-reports/:id", { schema: { params: Params } }, async (request) => {
    const data = await app.prisma.dataReport.findFirst({
      where: { id: request.params.id, userId: request.authUser!.id },
      select: ownerSelect,
    });
    if (!data) throw new AppError(404, "REPORT_NOT_FOUND", "Không tìm thấy báo cáo của bạn");
    return { data };
  });
  app.get(
    "/admin/data-reports",
    { preHandler: app.requireRoles("ADMIN"), schema: { querystring: Listing } },
    async (request) => {
      const limit = request.query.limit ?? 20,
        page = request.query.page ?? 1,
        where = request.query.status ? { status: request.query.status } : {};
      const [items, total] = await Promise.all([
        app.prisma.dataReport.findMany({
          where,
          select: { ...ownerSelect, userId: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        app.prisma.dataReport.count({ where }),
      ]);
      return { data: { items, total, page, limit } };
    },
  );
  app.get(
    "/admin/data-reports/:id",
    { preHandler: app.requireRoles("ADMIN"), schema: { params: Params } },
    async (request) => {
      const report = await app.prisma.dataReport.findUnique({
        where: { id: request.params.id },
        select: {
          ...ownerSelect,
          userId: true,
          reviews: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
      if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Không tìm thấy báo cáo");
      return { data: report };
    },
  );
  app.put(
    "/admin/data-reports/:id/review",
    {
      preHandler: [
        app.requireRoles("ADMIN"),
        createRateLimitHook({ keyPrefix: "report-review", limit: 60, windowMs: 60000 }),
      ],
      schema: {
        params: Params,
        body: Type.Object(
          {
            status: Status,
            expectedUpdatedAt: Type.String({ format: "date-time" }),
            reason: Type.String({ minLength: 1, maxLength: 1000 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (request) => {
      const reason = request.body.reason.trim();
      if (!reason)
        throw new AppError(400, "INVALID_REVIEW_REASON", "Nhập lý do xử lý hoặc mở lại báo cáo");
      const data = await app.prisma.$transaction(async (tx) => {
        const report = await tx.dataReport.findUnique({ where: { id: request.params.id } });
        if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Không tìm thấy báo cáo");
        const status = request.body.status;
        const allowed =
          report.status === "OPEN"
            ? ["IN_REVIEW", "RESOLVED", "DISMISSED"]
            : report.status === "IN_REVIEW"
              ? ["OPEN", "RESOLVED", "DISMISSED"]
              : ["OPEN"];
        if (!allowed.includes(status))
          throw new AppError(
            409,
            "REPORT_STATUS_CONFLICT",
            "Chuyển trạng thái không hợp lệ; tải lại báo cáo để kiểm tra",
          );
        const changed = await tx.dataReport.updateMany({
          where: {
            id: report.id,
            updatedAt: new Date(request.body.expectedUpdatedAt),
            status: report.status,
          },
          data: { status, updatedAt: new Date(Math.max(Date.now(), +report.updatedAt + 1)) },
        });
        if (!changed.count)
          throw new AppError(
            409,
            "REPORT_REVIEW_CONFLICT",
            "Báo cáo đã được xử lý ở phiên khác; hãy tải lại",
          );
        await tx.reportReview.create({
          data: {
            reportId: report.id,
            actorId: request.authUser!.id,
            fromStatus: report.status,
            toStatus: status,
            reason,
          },
        });
        await audit(tx, request.authUser!.id, "REPORT_REVIEW", report.id, {
          fromStatus: report.status,
          toStatus: status,
        });
        return tx.dataReport.findUniqueOrThrow({ where: { id: report.id }, select: ownerSelect });
      });
      return { data };
    },
  );
};
