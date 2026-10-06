import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { audit } from "../admin/admin.audit.js";
import { createMerchantService } from "./merchant.service.js";
import {
  menuAdapters,
  menuSyncEnabled,
  type MenuAdapterRegistry,
  type MenuManifest,
} from "./menu-sync.adapters.js";

const manifestHash = (value: MenuManifest) =>
  createHash("sha256")
    .update(JSON.stringify([value.snapshotId, value.observedAt, value.expectedPages, value.mode]))
    .digest("hex");
function validateManifest(value: MenuManifest) {
  if (
    !value ||
    typeof value.snapshotId !== "string" ||
    !/^[A-Za-z0-9._:-]{1,160}$/.test(value.snapshotId) ||
    !Number.isInteger(value.expectedPages) ||
    value.expectedPages < 1 ||
    value.expectedPages > 10 ||
    !["COMPLETE", "DELTA"].includes(value.mode) ||
    typeof value.observedAt !== "string" ||
    !Number.isFinite(Date.parse(value.observedAt))
  )
    throw new AppError(
      502,
      "MENU_SYNC_INVALID_DATA",
      "Nguồn trả về thông tin đồng bộ không hợp lệ.",
    );
  return {
    snapshotId: value.snapshotId,
    observedAt: new Date(value.observedAt).toISOString(),
    expectedPages: value.expectedPages,
    mode: value.mode,
  };
}
const permanent = new Set([
  "MENU_SYNC_INVALID_DATA",
  "MENU_SYNC_SNAPSHOT_CHANGED",
  "SYNC_INCOMPLETE",
  "SYNC_STALE",
  "SYNC_REPLAY_CONFLICT",
  "SYNC_PAGE_CONFLICT",
  "SYNC_NOT_STAGING",
  "DUPLICATE_OFFER",
  "INVALID_PAGE",
  "INVALID_FRESHNESS",
  "MENU_SYNC_PAUSED",
  "SUPPLIER_DISABLED",
]);
export function createMenuSyncService(
  prisma: PrismaClient,
  adapters: MenuAdapterRegistry = menuAdapters,
  enabled = menuSyncEnabled(),
) {
  const merchant = createMerchantService(prisma);
  const configuredCodes = () =>
    [...adapters].filter(([, adapter]) => adapter.configured).map(([code]) => code);
  return {
    configured: enabled && configuredCodes().length > 0,
    async schedule(now = new Date()) {
      const codes = configuredCodes();
      if (!enabled || !codes.length) return 0;
      return prisma.$transaction(async (tx) => {
        const rows = await tx.menuSyncSchedule.findMany({
          where: {
            enabled: true,
            nextRunAt: { lte: now },
            adapterCode: { in: codes },
            supplier: { enabled: true },
          },
          orderBy: { nextRunAt: "asc" },
          take: 10,
        });
        let added = 0;
        for (const row of rows) {
          const changed = await tx.menuSyncSchedule.updateMany({
            where: {
              supplierId: row.supplierId,
              updatedAt: row.updatedAt,
              nextRunAt: row.nextRunAt,
              enabled: true,
            },
            data: {
              nextRunAt: new Date(+now + row.intervalMinutes * 60000),
              updatedAt: new Date(Math.max(+now, +row.updatedAt + 1)),
            },
          });
          if (!changed.count) continue;
          const jobId = randomUUID();
          const job = await tx.menuSyncJob.createMany({
            data: [
              {
                id: jobId,
                scheduleId: row.supplierId,
                idempotencyKey: `scheduled:${row.supplierId}:${row.nextRunAt.toISOString()}`,
                availableAt: now,
              },
            ],
            skipDuplicates: true,
          });
          added += job.count;
          if (job.count) await audit(tx, null, "MENU_JOB_SCHEDULED", jobId, { automation: true });
        }
        return added;
      });
    },
    async tick(now = new Date(), scopeSupplierId?: string) {
      const codes = configuredCodes();
      if (!enabled || !codes.length) return false;
      await prisma.menuSyncJob.updateMany({
        where: {
          ...(scopeSupplierId ? { scheduleId: scopeSupplierId } : {}),
          status: "QUEUED",
          OR: [{ schedule: { enabled: false } }, { schedule: { supplier: { enabled: false } } }],
        },
        data: { status: "CANCELLED", retryable: false, errorCode: "MENU_SYNC_PAUSED" },
      });
      await prisma.menuSyncJob.updateMany({
        where: {
          ...(scopeSupplierId ? { scheduleId: scopeSupplierId } : {}),
          status: "RUNNING",
          leaseUntil: { lte: now },
          attempts: { gte: 5 },
        },
        data: {
          status: "FAILED",
          errorCode: "MENU_SYNC_INTERRUPTED",
          retryable: true,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      const token = randomUUID(),
        leaseUntil = new Date(+now + 180000);
      const claimed = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT j.id FROM menu_sync_jobs j JOIN menu_sync_schedules s ON s.supplier_id=j.schedule_id JOIN merchant_suppliers m ON m.id=s.supplier_id WHERE (${scopeSupplierId ?? null}::uuid IS NULL OR j.schedule_id=${scopeSupplierId ?? null}::uuid) AND s.enabled AND m.enabled AND s.adapter_code=ANY(${codes}::text[]) AND j.attempts<5 AND ((j.status='QUEUED' AND j.available_at<=${now}) OR (j.status='RUNNING' AND j.lease_until<=${now})) ORDER BY j.available_at,j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`;
        if (!rows[0]) return null;
        return tx.menuSyncJob.update({
          where: { id: rows[0].id },
          data: {
            status: "RUNNING",
            attempts: { increment: 1 },
            leaseToken: token,
            leaseUntil,
            errorCode: null,
          },
          include: { schedule: true },
        });
      });
      if (!claimed) return false;
      const controller = new AbortController();
      let rejectDeadline: (reason: Error) => void = () => {};
      const deadline = new Promise<never>((_resolve, reject) => {
        rejectDeadline = reject;
      });
      const timer = setTimeout(() => {
        controller.abort();
        rejectDeadline(new AppError(504, "MENU_SYNC_TIMEOUT", "Đồng bộ quá thời gian xử lý."));
      }, 120000);
      async function guard() {
        if (controller.signal.aborted)
          throw new AppError(504, "MENU_SYNC_TIMEOUT", "Đồng bộ quá thời gian xử lý.");
        const current = await prisma.menuSyncJob.findFirst({
          where: {
            id: claimed!.id,
            status: "RUNNING",
            leaseToken: token,
            leaseUntil: { gt: new Date() },
          },
          include: { schedule: { include: { supplier: true } } },
        });
        if (!current)
          throw new AppError(409, "MENU_SYNC_LEASE_LOST", "Lượt đồng bộ đã hết quyền xử lý.");
        if (!current.schedule.enabled || !current.schedule.supplier.enabled)
          throw new AppError(409, "MENU_SYNC_PAUSED", "Nguồn hoặc lịch đồng bộ đã tạm ngừng.");
      }
      try {
        const adapter = adapters.get(claimed.schedule.adapterCode)!;
        await guard();
        const manifest = validateManifest(
          await Promise.race([
            adapter.snapshot(claimed.scheduleId, claimed.id, controller.signal),
            deadline,
          ]),
        );
        if (
          claimed.manifest &&
          manifestHash(claimed.manifest as unknown as MenuManifest) !== manifestHash(manifest)
        )
          throw new AppError(
            409,
            "MENU_SYNC_SNAPSHOT_CHANGED",
            "Snapshot đã đổi; cần tạo lượt đồng bộ mới.",
          );
        await guard();
        const bound = await prisma.menuSyncJob.updateMany({
          where: { id: claimed.id, status: "RUNNING", leaseToken: token },
          data: { manifest: manifest as unknown as Prisma.InputJsonValue },
        });
        if (!bound.count)
          throw new AppError(409, "MENU_SYNC_LEASE_LOST", "Lượt đồng bộ đã hết quyền xử lý.");
        const run = await merchant.start(
          { ...manifest, supplierId: claimed.scheduleId, snapshotId: `job-${claimed.id}` },
          null,
        );
        await prisma.menuSyncJob.updateMany({
          where: { id: claimed.id, status: "RUNNING", leaseToken: token },
          data: { runId: run.id },
        });
        for (let page = 0; page < manifest.expectedPages; page++) {
          await guard();
          const rows = await Promise.race([
            adapter.page(claimed.scheduleId, manifest, page, controller.signal),
            deadline,
          ]);
          if (!Array.isArray(rows) || rows.length > 100)
            throw new AppError(
              502,
              "MENU_SYNC_INVALID_DATA",
              "Trang thực đơn vượt giới hạn dữ liệu.",
            );
          await guard();
          await merchant.stage(run.id, page, rows, null);
        }
        await guard();
        await merchant.commit(run.id, null, { jobId: claimed.id, leaseToken: token });
        await prisma.$transaction(async (tx) => {
          const changed = await tx.menuSyncJob.updateMany({
            where: { id: claimed.id, status: "RUNNING", leaseToken: token },
            data: {
              status: "SUCCEEDED",
              retryable: false,
              leaseToken: null,
              leaseUntil: null,
              errorCode: null,
            },
          });
          if (changed.count)
            await audit(tx, null, "MENU_JOB_COMPLETED", claimed.id, {
              automation: true,
              attempts: claimed.attempts,
            });
        });
      } catch (error) {
        const known = error instanceof AppError ? error.code : "MENU_SYNC_UNAVAILABLE";
        const retryable = !permanent.has(known),
          code =
            permanent.has(known) || ["MENU_SYNC_TIMEOUT", "MENU_SYNC_LEASE_LOST"].includes(known)
              ? known
              : "MENU_SYNC_UNAVAILABLE";
        await prisma.$transaction(async (tx) => {
          const changed = await tx.menuSyncJob.updateMany({
            where: { id: claimed.id, status: "RUNNING", leaseToken: token },
            data: {
              status: retryable && claimed.attempts < 5 ? "QUEUED" : "FAILED",
              retryable,
              errorCode: code,
              availableAt: new Date(Date.now() + Math.min(60000, 1000 * 2 ** claimed.attempts)),
              leaseToken: null,
              leaseUntil: null,
            },
          });
          if (changed.count)
            await audit(tx, null, "MENU_JOB_FAILED_ATTEMPT", claimed.id, {
              automation: true,
              attempts: claimed.attempts,
              code,
              retryable,
            });
        });
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
      return true;
    },
  };
}
