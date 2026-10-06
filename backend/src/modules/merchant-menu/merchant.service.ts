import { createHash } from "node:crypto";
import type { PrismaClient, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { normalizeFoodText } from "../food/food.schema.js";
import { audit } from "../admin/admin.audit.js";
import { validateMenuRow, type MenuRow } from "./merchant.schema.js";

type Tx = Prisma.TransactionClient;
const fail = (code: string, message: string) => new AppError(409, code, message);
async function mapping(tx: Tx | PrismaClient, title: string) {
  const candidates = await tx.dish.findMany({
    where: {
      OR: [
        { name: { equals: title.trim(), mode: "insensitive" } },
        { aliases: { some: { normalizedAlias: normalizeFoodText(title) } } },
      ],
    },
    select: { id: true, name: true },
    take: 2,
  });
  return { dishId: candidates.length === 1 ? candidates[0]!.id : null, candidates };
}
export function createMerchantService(prisma: PrismaClient) {
  const supplier = async (id: string) => {
    const source = await prisma.merchantSupplier.findUnique({ where: { id } });
    if (!source?.enabled)
      throw new AppError(409, "SUPPLIER_DISABLED", "Nguồn thực đơn chưa được cho phép hoạt động");
    return source;
  };
  return {
    async preview(supplierId: string, items: unknown[]) {
      const source = await supplier(supplierId);
      return Promise.all(
        items.map(async (value, index) => {
          try {
            const row = validateMenuRow(value, source.maxEvidenceAgeHours);
            return {
              index,
              valid: true,
              title: row.title,
              price: row.price,
              ...(await mapping(prisma, row.title)),
            };
          } catch (err) {
            return {
              index,
              valid: false,
              code: err instanceof AppError ? err.code : "INVALID_MENU_ROW",
            };
          }
        }),
      );
    },
    async start(
      input: {
        supplierId: string;
        snapshotId: string;
        mode: "COMPLETE" | "DELTA";
        expectedPages: number;
        observedAt: string;
      },
      actorId: string,
    ) {
      await supplier(input.supplierId);
      const observedAt = new Date(input.observedAt);
      if (!Number.isFinite(+observedAt) || +observedAt > Date.now() + 300000)
        throw new AppError(400, "INVALID_FRESHNESS", "Thời điểm snapshot không hợp lệ");
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM merchant_suppliers WHERE id = ${input.supplierId}::uuid FOR UPDATE`;
        const lockedSource = await tx.merchantSupplier.findUnique({
          where: { id: input.supplierId },
        });
        if (!lockedSource?.enabled)
          throw fail("SUPPLIER_DISABLED", "Nguồn đã bị tắt; hãy tải lại dữ liệu");
        const existing = await tx.menuSyncRun.findUnique({
          where: {
            supplierId_snapshotId: { supplierId: input.supplierId, snapshotId: input.snapshotId },
          },
        });
        if (existing) {
          if (
            existing.mode !== input.mode ||
            existing.expectedPages !== input.expectedPages ||
            +existing.observedAt !== +observedAt
          )
            throw fail("SYNC_REPLAY_CONFLICT", "Snapshot đã tồn tại với nội dung khác");
          return existing;
        }
        const run = await tx.menuSyncRun.create({ data: { ...input, observedAt } });
        await audit(tx, actorId, "MENU_SYNC_STARTED", run.id, {
          mode: input.mode,
          expectedPages: input.expectedPages,
        });
        return run;
      });
    },
    async stage(id: string, page: number, items: unknown[], actorId: string) {
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM menu_sync_runs WHERE id = ${id}::uuid FOR UPDATE`;
        const run = await tx.menuSyncRun.findUnique({ where: { id }, include: { supplier: true } });
        if (!run) throw new AppError(404, "SYNC_NOT_FOUND", "Không tìm thấy lần đồng bộ");
        if (!run.supplier.enabled) throw fail("SUPPLIER_DISABLED", "Nguồn thực đơn đã tắt");
        if (page >= run.expectedPages)
          throw new AppError(400, "INVALID_PAGE", "Trang nằm ngoài snapshot");
        const hash = createHash("sha256").update(JSON.stringify(items)).digest("hex");
        const old = await tx.menuSyncPage.findUnique({
          where: { runId_page: { runId: id, page } },
        });
        if (old) {
          if (old.hash !== hash)
            throw fail(
              "SYNC_PAGE_CONFLICT",
              "Trang đã nhận có nội dung khác; hãy bắt đầu snapshot mới",
            );
          return {
            accepted: true,
            replayed: true,
            quarantined: await tx.menuQuarantine.count({ where: { runId: id, page } }),
          };
        }
        if (run.status !== "STAGING")
          throw fail("SYNC_NOT_STAGING", "Lần đồng bộ không còn nhận dữ liệu");
        const valid: MenuRow[] = [];
        const errors: { runId: string; page: number; rowIndex: number; code: string }[] = [];
        for (const [rowIndex, value] of items.entries()) {
          try {
            const row = validateMenuRow(value, run.supplier.maxEvidenceAgeHours);
            if (+new Date(row.observedAt) > +run.observedAt + 300000)
              throw fail("INVALID_FRESHNESS", "Dữ liệu mới hơn snapshot");
            valid.push(row);
          } catch (err) {
            errors.push({
              runId: id,
              page,
              rowIndex,
              code: err instanceof AppError ? err.code : "INVALID_MENU_ROW",
            });
          }
        }
        await tx.menuSyncPage.create({
          data: { runId: id, page, hash, items: valid as unknown as Prisma.InputJsonArray },
        });
        if (errors.length) await tx.menuQuarantine.createMany({ data: errors });
        await audit(tx, actorId, "MENU_PAGE_STAGED", id, {
          page,
          accepted: valid.length,
          quarantined: errors.length,
        });
        return { accepted: true, replayed: false, quarantined: errors.length };
      });
    },
    async commit(id: string, actorId: string) {
      return prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM menu_sync_runs WHERE id = ${id}::uuid FOR UPDATE`;
          const run = await tx.menuSyncRun.findUnique({
            where: { id },
            include: {
              pages: { orderBy: { page: "asc" } },
              _count: { select: { quarantine: true } },
            },
          });
          if (!run) throw new AppError(404, "SYNC_NOT_FOUND", "Không tìm thấy lần đồng bộ");
          if (run.status === "COMMITTED") return { run, replayed: true };
          if (
            run.status !== "STAGING" ||
            run.pages.length !== run.expectedPages ||
            run.pages.some((p, i) => p.page !== i) ||
            run._count.quarantine
          )
            throw fail(
              "SYNC_INCOMPLETE",
              "Chưa đủ trang hoặc có dữ liệu lỗi. Thực đơn hiện tại được giữ nguyên",
            );
          await tx.$queryRaw`SELECT id FROM merchant_suppliers WHERE id = ${run.supplierId}::uuid FOR UPDATE`;
          const source = await tx.merchantSupplier.findUniqueOrThrow({
            where: { id: run.supplierId },
          });
          if (!source.enabled) throw fail("SUPPLIER_DISABLED", "Nguồn thực đơn đã tắt");
          if (source.lastCommittedAt && run.observedAt <= source.lastCommittedAt)
            throw fail("SYNC_STALE", "Snapshot cũ không được thay thực đơn mới");
          const items = run.pages.flatMap((p) => p.items as unknown as MenuRow[]);
          const keys = new Set<string>();
          const restaurantFacts = new Map<string, string>();
          for (const row of items) {
            validateMenuRow(row, source.maxEvidenceAgeHours);
            const key = JSON.stringify([row.restaurant.externalId, row.externalId]);
            if (keys.has(key))
              throw fail("DUPLICATE_OFFER", "Snapshot chứa lựa chọn món trùng lặp");
            keys.add(key);
            const fact = JSON.stringify(row.restaurant),
              previous = restaurantFacts.get(row.restaurant.externalId);
            if (previous && previous !== fact)
              throw fail("RESTAURANT_CONFLICT", "Thông tin cùng quán bị mâu thuẫn");
            restaurantFacts.set(row.restaurant.externalId, fact);
            let identity = await tx.externalRestaurantIdentity.findUnique({
              where: {
                supplierId_externalId: {
                  supplierId: source.id,
                  externalId: row.restaurant.externalId,
                },
              },
            });
            if (!identity) {
              const restaurant = await tx.restaurant.create({
                data: {
                  name: row.restaurant.name.trim(),
                  address: row.restaurant.address.trim(),
                  latitude: row.restaurant.latitude,
                  longitude: row.restaurant.longitude,
                },
              });
              identity = await tx.externalRestaurantIdentity.create({
                data: {
                  supplierId: source.id,
                  externalId: row.restaurant.externalId,
                  restaurantId: restaurant.id,
                },
              });
            } else
              await tx.restaurant.update({
                where: { id: identity.restaurantId },
                data: {
                  name: row.restaurant.name.trim(),
                  address: row.restaurant.address.trim(),
                  latitude: row.restaurant.latitude,
                  longitude: row.restaurant.longitude,
                },
              });
            const canonical = await mapping(tx, row.title);
            const where = {
              identityId_externalId: { identityId: identity.id, externalId: row.externalId },
            };
            const old = await tx.externalMenuItem.findUnique({ where });
            const sameTitle = old && normalizeFoodText(old.title) === normalizeFoodText(row.title);
            const dishId =
              sameTitle && old.mappingStatus === "APPROVED" ? old.dishId : canonical.dishId;
            const fields = {
              title: row.title.trim(),
              optionLabel: row.optionLabel ?? null,
              price: row.price,
              currency: row.currency,
              isAvailable: row.isAvailable,
              active: true,
              sourceUrl: row.sourceUrl,
              observedAt: new Date(row.observedAt),
              expiresAt: new Date(row.expiresAt),
              dishId,
              mappingStatus: dishId ? ("APPROVED" as const) : ("PENDING" as const),
              lastSyncRunId: id,
            };
            await tx.externalMenuItem.upsert({
              where,
              create: { ...where.identityId_externalId, ...fields },
              update: fields,
            });
            // A changed preparation/title invalidates prior approved safety, never inherits a safe claim.
            if (old && (!sameTitle || old.optionLabel !== fields.optionLabel)) {
              const activeEvidence = await tx.offerSafetyEvidence.findMany({
                where: { offerId: old.id, status: "APPROVED" },
              });
              for (const e of activeEvidence) {
                await tx.offerSafetyEvidence.update({
                  where: { id: e.id },
                  data: { status: "REVOKED" },
                });
                await tx.evidenceReview.create({
                  data: {
                    evidenceId: e.id,
                    actorId,
                    status: "REVOKED",
                    reason: "Supplier changed offer title or option",
                  },
                });
              }
            }
          }
          if (run.mode === "COMPLETE")
            await tx.externalMenuItem.updateMany({
              where: { identity: { supplierId: source.id }, lastSyncRunId: { not: id } },
              data: { isAvailable: false },
            });
          await tx.merchantSupplier.update({
            where: { id: source.id },
            data: { lastCommittedAt: run.observedAt },
          });
          const committed = await tx.menuSyncRun.update({
            where: { id },
            data: { status: "COMMITTED", committedAt: new Date(), errorCode: null },
          });
          await audit(tx, actorId, "MENU_SYNC_COMMITTED", id, {
            mode: run.mode,
            offers: items.length,
          });
          return { run: committed, replayed: false };
        },
        { timeout: 60000 },
      );
    },
  };
}
