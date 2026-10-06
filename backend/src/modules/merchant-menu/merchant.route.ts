import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AppError } from "../../common/errors/app-error.js";
import { createRateLimitHook } from "../../common/security/rate-limit.js";
import { audit } from "../admin/admin.audit.js";
import { createMerchantService } from "./merchant.service.js";
import {
  SupplierWriteSchema,
  SyncStartSchema,
  PageSchema,
  EvidenceSchema,
  evidenceUrl,
  checkFreshness,
} from "./merchant.schema.js";

const Id = Type.Object({ id: Type.String({ format: "uuid" }) }, { additionalProperties: false });
const Listing = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);
export const merchantRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireRoles("ADMIN"));
  app.addHook(
    "preHandler",
    createRateLimitHook({ keyPrefix: "merchant-admin", limit: 120, windowMs: 60000 }),
  );
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "private, no-store");
  });
  const service = createMerchantService(app.prisma);
  app.get("/admin/menu/suppliers", async () => ({
    data: {
      items: await app.prisma.merchantSupplier.findMany({ orderBy: { code: "asc" }, take: 100 }),
    },
  }));
  app.put("/admin/menu/suppliers", { schema: { body: SupplierWriteSchema } }, async (req) => {
    const input = req.body;
    if (!input.name.trim() || !input.authorizationReference.trim())
      throw new AppError(
        400,
        "SOURCE_AUTHORIZATION_REQUIRED",
        "Cần tên nguồn và bằng chứng quyền sử dụng dữ liệu",
      );
    evidenceUrl(input.documentationUrl);
    return {
      data: {
        supplier: await app.prisma.$transaction(async (tx) => {
          const supplier = await tx.merchantSupplier.upsert({
            where: { code: input.code },
            create: input,
            update: input,
          });
          await audit(tx, req.authUser!.id, "SUPPLIER_UPDATED", supplier.id, {
            enabled: supplier.enabled,
            maxEvidenceAgeHours: supplier.maxEvidenceAgeHours,
          });
          return supplier;
        }),
      },
    };
  });
  app.post(
    "/admin/menu/preview",
    {
      schema: {
        body: Type.Object(
          {
            supplierId: Type.String({ format: "uuid" }),
            items: Type.Array(Type.Unknown(), { maxItems: 100 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => ({
      data: { items: await service.preview(req.body.supplierId, req.body.items) },
    }),
  );
  app.post("/admin/menu/sync-runs", { schema: { body: SyncStartSchema } }, async (req, reply) =>
    reply.code(201).send({ data: { run: await service.start(req.body, req.authUser!.id) } }),
  );
  app.get("/admin/menu/sync-runs", { schema: { querystring: Listing } }, async (req) => {
    const limit = req.query.limit ?? 20,
      page = req.query.page ?? 1;
    return {
      data: {
        items: await app.prisma.menuSyncRun.findMany({
          include: {
            supplier: { select: { code: true, name: true } },
            _count: { select: { pages: true, quarantine: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        page,
        limit,
      },
    };
  });
  app.get("/admin/menu/sync-runs/:id", { schema: { params: Id } }, async (req) => {
    const run = await app.prisma.menuSyncRun.findUnique({
      where: { id: req.params.id },
      include: { quarantine: true, pages: { select: { page: true, hash: true } } },
    });
    if (!run) throw new AppError(404, "SYNC_NOT_FOUND", "Không tìm thấy lần đồng bộ");
    return { data: { run } };
  });
  app.post(
    "/admin/menu/sync-runs/:id/pages",
    { schema: { params: Id, body: PageSchema } },
    async (req) => ({
      data: await service.stage(req.params.id, req.body.page, req.body.items, req.authUser!.id),
    }),
  );
  app.post("/admin/menu/sync-runs/:id/commit", { schema: { params: Id } }, async (req) => ({
    data: await service.commit(req.params.id, req.authUser!.id),
  }));
  app.post("/admin/menu/sync-runs/:id/abandon", { schema: { params: Id } }, async (req) => ({
    data: await app.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM menu_sync_runs WHERE id = ${req.params.id}::uuid FOR UPDATE`;
      const run = await tx.menuSyncRun.findUnique({ where: { id: req.params.id } });
      if (!run || run.status !== "STAGING")
        throw new AppError(409, "SYNC_NOT_STAGING", "Chỉ được dừng snapshot chưa áp dụng");
      await tx.menuSyncRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorCode: "ADMIN_ABANDONED" },
      });
      await audit(tx, req.authUser!.id, "MENU_SYNC_ABANDONED", run.id);
      return { abandoned: true };
    }),
  }));
  app.get("/admin/menu/offers", { schema: { querystring: Listing } }, async (req) => {
    const limit = req.query.limit ?? 20,
      page = req.query.page ?? 1;
    return {
      data: {
        items: await app.prisma.externalMenuItem.findMany({
          include: {
            identity: {
              include: {
                restaurant: true,
                supplier: { select: { code: true, name: true, enabled: true } },
              },
            },
            dish: { select: { id: true, name: true } },
            evidence: { include: { reviews: true }, orderBy: { createdAt: "desc" } },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        page,
        limit,
      },
    };
  });
  app.put(
    "/admin/menu/offers/:id/mapping",
    {
      schema: {
        params: Id,
        body: Type.Object(
          {
            dishId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
            expectedUpdatedAt: Type.String({ format: "date-time" }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => ({
      data: await app.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM external_menu_items WHERE id = ${req.params.id}::uuid FOR UPDATE`;
        const offer = await tx.externalMenuItem.findUnique({ where: { id: req.params.id } });
        if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Không tìm thấy món tại quán");
        if (+offer.updatedAt !== +new Date(req.body.expectedUpdatedAt))
          throw new AppError(
            409,
            "OFFER_CHANGED",
            "Món đã thay đổi, hãy tải lại trước khi liên kết",
          );
        if (req.body.dishId && !(await tx.dish.findUnique({ where: { id: req.body.dishId } })))
          throw new AppError(400, "DISH_NOT_FOUND", "Món chuẩn không tồn tại");
        const updated = await tx.externalMenuItem.update({
          where: { id: offer.id },
          data: {
            dishId: req.body.dishId,
            mappingStatus: req.body.dishId ? "APPROVED" : "PENDING",
          },
        });
        await audit(tx, req.authUser!.id, "OFFER_MAPPING_REVIEWED", offer.id, {
          dishId: req.body.dishId,
        });
        return { offer: updated };
      }),
    }),
  );
  app.post(
    "/admin/menu/offers/:id/evidence",
    { schema: { params: Id, body: EvidenceSchema } },
    async (req, reply) => {
      const input = req.body;
      evidenceUrl(input.sourceUrl);
      if (!input.excerpt.trim())
        throw new AppError(400, "INVALID_EVIDENCE", "Cần trích đoạn bằng chứng");
      const offer = await app.prisma.externalMenuItem.findUnique({
        where: { id: req.params.id },
        include: { identity: { include: { supplier: true } } },
      });
      if (!offer) throw new AppError(404, "OFFER_NOT_FOUND", "Không tìm thấy món tại quán");
      const known =
        input.kind === "DIET"
          ? await app.prisma.dietaryRestriction.findUnique({ where: { code: input.code } })
          : await app.prisma.allergen.findUnique({ where: { code: input.code } });
      if (!known) throw new AppError(400, "UNKNOWN_CATALOG_CODE", "Mã ràng buộc không tồn tại");
      const dates = checkFreshness(
        input.observedAt,
        input.expiresAt,
        offer.identity.supplier.maxEvidenceAgeHours,
      );
      return reply.code(201).send({
        data: {
          evidence: await app.prisma.$transaction(async (tx) => {
            const evidence = await tx.offerSafetyEvidence.create({
              data: { ...input, ...dates, offerId: offer.id },
            });
            await audit(tx, req.authUser!.id, "SAFETY_EVIDENCE_SUBMITTED", evidence.id, {
              kind: input.kind,
              code: input.code,
              claim: input.claim,
            });
            return evidence;
          }),
        },
      });
    },
  );
  app.post(
    "/admin/menu/evidence/:id/review",
    {
      schema: {
        params: Id,
        body: Type.Object(
          {
            status: Type.Union([Type.Literal("APPROVED"), Type.Literal("REVOKED")]),
            expectedStatus: Type.Union([
              Type.Literal("PENDING"),
              Type.Literal("APPROVED"),
              Type.Literal("REVOKED"),
            ]),
            reason: Type.String({ minLength: 1, maxLength: 1000 }),
          },
          { additionalProperties: false },
        ),
      },
    },
    async (req) => ({
      data: await app.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM offer_safety_evidence WHERE id = ${req.params.id}::uuid FOR UPDATE`;
        const evidence = await tx.offerSafetyEvidence.findUnique({
          where: { id: req.params.id },
          include: { offer: { include: { identity: { include: { supplier: true } } } } },
        });
        if (!evidence) throw new AppError(404, "EVIDENCE_NOT_FOUND", "Không tìm thấy bằng chứng");
        if (!req.body.reason.trim())
          throw new AppError(400, "REVIEW_REASON_REQUIRED", "Cần lý do xác nhận");
        if (evidence.status === req.body.status) return { evidence, replayed: true };
        if (evidence.status !== req.body.expectedStatus || evidence.status === "REVOKED")
          throw new AppError(
            409,
            "EVIDENCE_REVIEW_CONFLICT",
            "Trạng thái đã thay đổi; bằng chứng bị thu hồi không được tự khôi phục",
          );
        if (req.body.status === "APPROVED")
          checkFreshness(
            evidence.observedAt.toISOString(),
            evidence.expiresAt.toISOString(),
            evidence.offer.identity.supplier.maxEvidenceAgeHours,
          );
        const updated = await tx.offerSafetyEvidence.update({
          where: { id: evidence.id },
          data: { status: req.body.status },
        });
        await tx.evidenceReview.create({
          data: {
            evidenceId: evidence.id,
            actorId: req.authUser!.id,
            status: req.body.status,
            reason: req.body.reason.trim(),
          },
        });
        await audit(tx, req.authUser!.id, "SAFETY_EVIDENCE_REVIEWED", evidence.id, {
          status: req.body.status,
        });
        return { evidence: updated, replayed: false };
      }),
    }),
  );
};
