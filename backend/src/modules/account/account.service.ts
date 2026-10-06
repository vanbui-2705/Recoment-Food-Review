import { randomUUID } from "node:crypto";
import { verify } from "argon2";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { assertAdminRemains } from "../admin/admin.users.js";
import { audit } from "../admin/admin.audit.js";

export async function reauthenticate(prisma: PrismaClient, userId: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, authVersion: true, status: true },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !(await verify(user.passwordHash, password).catch(() => false))
  )
    throw new AppError(
      403,
      "ACCOUNT_REAUTH_REQUIRED",
      "Mật khẩu hiện tại chưa đúng. Nhập lại để xác nhận thao tác dữ liệu cá nhân.",
    );
  return user;
}
export function createAccountService(prisma: PrismaClient, workerEnabled: boolean) {
  return {
    async requestDeletion(userId: string, password: string) {
      if (!workerEnabled)
        throw new AppError(
          503,
          "ACCOUNT_DELETION_UNAVAILABLE",
          "Xử lý xóa dữ liệu tạm thời chưa sẵn sàng. Tài khoản của bạn chưa bị thay đổi.",
        );
      const authenticated = await reauthenticate(prisma, userId, password);
      return serializableWrite(prisma, async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('rec-food-admin-access'))::text`;
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (
          !user ||
          user.status !== "ACTIVE" ||
          user.passwordHash !== authenticated.passwordHash ||
          user.authVersion !== authenticated.authVersion
        )
          throw new AppError(409, "ACCOUNT_CHANGED", "Tài khoản đã thay đổi. Hãy đăng nhập lại.");
        assertAdminRemains(
          user.role,
          user.status,
          "DISABLED",
          await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
        );
        const job = await tx.accountDeletionJob.create({ data: { userId } });
        await tx.user.update({
          where: { id: userId },
          data: { status: "DISABLED", authVersion: { increment: 1 }, legacyAccessDisabled: true },
        });
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await audit(tx, userId, "ACCOUNT_DELETE_REQUEST", userId, { requestId: job.id });
        return { status: "DELETION_QUEUED", requestId: job.id, requestedAt: job.createdAt };
      });
    },
    async tick(scopeUserId?: string) {
      if (!workerEnabled) return false;
      const claimed = await serializableWrite(prisma, async (tx) => {
        const exhausted = await tx.accountDeletionJob.findMany({
          where: {
            ...(scopeUserId ? { userId: scopeUserId } : {}),
            status: "RUNNING",
            attempts: { gte: 5 },
            leaseUntil: { lte: new Date() },
          },
          select: { id: true },
          take: 100,
        });
        if (exhausted.length)
          await tx.accountDeletionJob.updateMany({
            where: {
              id: { in: exhausted.map((row) => row.id) },
              status: "RUNNING",
              leaseUntil: { lte: new Date() },
            },
            data: {
              status: "FAILED",
              leaseToken: null,
              leaseUntil: null,
              errorCode: "ACCOUNT_DELETE_ATTEMPTS_EXHAUSTED",
            },
          });
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT j.id FROM account_deletion_jobs j JOIN users u ON u.id=j.user_id
          WHERE (j.status='QUEUED' OR (j.status='RUNNING' AND j.lease_until<=NOW())) AND j.available_at<=NOW() AND j.attempts<5 AND u.status='DISABLED'
            AND (${scopeUserId ?? null}::uuid IS NULL OR u.id=${scopeUserId ?? null}::uuid)
          ORDER BY j.created_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED`;
        if (!rows[0]) return null;
        return tx.accountDeletionJob.update({
          where: { id: rows[0].id },
          data: {
            status: "RUNNING",
            attempts: { increment: 1 },
            leaseToken: randomUUID(),
            leaseUntil: new Date(Date.now() + 60000),
            errorCode: null,
          },
        });
      });
      if (!claimed) return false;
      try {
        await serializableWrite(prisma, async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '4000ms'`;
          const held = await tx.accountDeletionJob.findFirst({
            where: {
              id: claimed.id,
              status: "RUNNING",
              leaseToken: claimed.leaseToken,
              leaseUntil: { gt: new Date() },
              user: { status: "DISABLED" },
            },
          });
          if (!held) return;
          await tx.$queryRaw`SELECT set_config('rec_food.anonymized_user', ${held.userId}, true)`;
          await tx.reportReview.updateMany({
            where: {
              OR: [{ actorId: held.userId }, { report: { userId: held.userId } }],
            },
            data: { reason: "Nội dung đã được ẩn danh theo yêu cầu xóa tài khoản." },
          });
          await tx.reportReview.updateMany({
            where: { actorId: held.userId },
            data: { actorId: null },
          });
          await tx.$executeRaw`UPDATE data_reports SET user_id=NULL, note='Người gửi đã xóa tài khoản.',
            idempotency_key='anonymous:' || id::text, input_hash=${"0".repeat(64)}, updated_at=NOW() WHERE user_id=${held.userId}::uuid`;
          await tx.evidenceReview.updateMany({
            where: { actorId: held.userId },
            data: {
              actorId: null,
              reason: "Người thao tác đã xóa tài khoản; kết quả xét duyệt vẫn được giữ.",
            },
          });
          await tx.adminAudit.updateMany({
            where: { actorId: held.userId },
            data: { actorId: null },
          });
          await tx.adminAudit.updateMany({
            where: { targetId: held.userId },
            data: { targetId: null },
          });
          await tx.user.delete({ where: { id: held.userId } });
          await tx.adminAudit.create({
            data: {
              actorId: null,
              targetId: null,
              action: "ACCOUNT_DELETED",
              metadata: { requestId: claimed.id },
            },
          });
        });
      } catch {
        await prisma.accountDeletionJob.updateMany({
          where: {
            id: claimed.id,
            status: "RUNNING",
            leaseToken: claimed.leaseToken,
            leaseUntil: { gt: new Date() },
          },
          data: {
            status: claimed.attempts < 5 ? "QUEUED" : "FAILED",
            leaseToken: null,
            leaseUntil: null,
            errorCode: "ACCOUNT_DELETE_FAILED",
            availableAt: new Date(
              Date.now() + Math.min(300, 15 * 2 ** (claimed.attempts - 1)) * 1000,
            ),
          },
        });
      }
      return true;
    },
  };
}
