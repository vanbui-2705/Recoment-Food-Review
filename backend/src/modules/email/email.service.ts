import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { serializableWrite } from "../../common/security/transaction-retry.js";
import { createRefreshToken, hashRefreshToken } from "../../common/security/token.js";
import { hashPassword } from "../../common/security/password.js";
import type { EmailConfig } from "./email.config.js";
import { decryptEmail, encryptEmail } from "./email.crypto.js";
import { EmailProviderError, type EmailPayload, type EmailProvider } from "./email.provider.js";

const invalidLink = () =>
  new AppError(
    410,
    "EMAIL_LINK_INVALID",
    "Liên kết đã hết hạn hoặc đã được dùng. Hãy yêu cầu liên kết mới.",
  );
export function createEmailService(
  prisma: PrismaClient,
  config: EmailConfig,
  provider: EmailProvider,
) {
  return {
    configured: config.configured && provider.configured,
    async enqueue(email: string, purpose: "RESET" | "VERIFY") {
      if (!config.configured || !provider.configured)
        throw new AppError(
          503,
          "EMAIL_NOT_CONFIGURED",
          "Email hỗ trợ chưa được cấu hình. Chưa có email nào được gửi.",
        );
      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true },
      });
      if (!user) return;
      await serializableWrite(prisma, async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id } });
        if (
          !current ||
          current.status !== "ACTIVE" ||
          (purpose === "VERIFY" && current.emailVerifiedAt)
        )
          return;
        const recent = await tx.emailActionToken.findMany({
          where: { userId: user.id, purpose, createdAt: { gte: new Date(Date.now() - 86400000) } },
          select: { createdAt: true },
          take: 5,
          orderBy: { createdAt: "desc" },
        });
        if (recent.length >= 5 || (recent[0] && recent[0].createdAt.getTime() > Date.now() - 60000))
          return;
        const secret = createRefreshToken(),
          id = randomUUID();
        const link = `${config.appUrl.replace(/\/$/, "")}/#${purpose === "RESET" ? "reset-password" : "verify-email"}/${secret.token}`;
        const payload: EmailPayload = {
          from: config.from,
          to: [current.email],
          subject: purpose === "RESET" ? "EatWise — Đặt lại mật khẩu" : "EatWise — Xác minh email",
          text: `${purpose === "RESET" ? "Để đặt lại mật khẩu" : "Để xác minh email"}, mở liên kết dưới đây và xác nhận trong app:\n${link}\n\nLiên kết có hiệu lực 30 phút và chỉ dùng một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
        };
        await tx.emailActionToken.create({
          data: {
            userId: current.id,
            purpose,
            tokenHash: secret.tokenHash,
            authVersion: current.authVersion,
            expiresAt: new Date(Date.now() + 1800000),
            outbox: {
              create: {
                id,
                encryptedBody: encryptEmail(JSON.stringify(payload), config.keyHex, id),
              },
            },
          },
        });
      });
    },
    async consume(token: string, purpose: "RESET" | "VERIFY", newPassword?: string) {
      const tokenHash = hashRefreshToken(token);
      const found = await prisma.emailActionToken.findUnique({
        where: { tokenHash },
        select: { purpose: true, consumedAt: true, expiresAt: true },
      });
      if (
        !found ||
        found.purpose !== purpose ||
        found.consumedAt ||
        found.expiresAt.getTime() <= Date.now()
      )
        throw invalidLink();
      if (purpose === "RESET" && !newPassword) throw invalidLink();
      const passwordHash = newPassword ? await hashPassword(newPassword) : undefined;
      await serializableWrite(prisma, async (tx) => {
        const row = await tx.emailActionToken.findUnique({
          where: { tokenHash },
          include: { user: true },
        });
        if (
          !row ||
          row.purpose !== purpose ||
          row.consumedAt ||
          row.expiresAt.getTime() <= Date.now() ||
          row.user.status !== "ACTIVE" ||
          row.authVersion !== row.user.authVersion
        )
          throw invalidLink();
        const claimed = await tx.emailActionToken.updateMany({
          where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() } },
          data: { consumedAt: new Date() },
        });
        if (!claimed.count) throw invalidLink();
        const updated = await tx.user.updateMany({
          where: { id: row.userId, authVersion: row.authVersion, status: "ACTIVE" },
          data:
            purpose === "RESET"
              ? { passwordHash: passwordHash!, authVersion: { increment: 1 } }
              : { emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() },
        });
        if (!updated.count) throw invalidLink();
        await tx.emailActionToken.updateMany({
          where: { userId: row.userId, purpose, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (purpose === "RESET")
          await tx.refreshToken.updateMany({
            where: { userId: row.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
      });
    },
    async tick(scopeUserId?: string): Promise<boolean> {
      if (!config.configured || !provider.configured) return false;
      await prisma.$executeRaw`
        WITH invalid AS (
          SELECT o.id FROM email_outbox o JOIN email_action_tokens t ON t.id = o.token_id JOIN users u ON u.id = t.user_id
          WHERE o.status IN ('QUEUED','PROCESSING') AND (${scopeUserId ?? null}::uuid IS NULL OR u.id = ${scopeUserId ?? null}::uuid)
            AND (t.expires_at <= NOW() OR t.consumed_at IS NOT NULL OR u.status <> 'ACTIVE' OR u.auth_version <> t.auth_version OR (o.attempts >= 5 AND (o.lease_until IS NULL OR o.lease_until <= NOW())))
          ORDER BY o.created_at LIMIT 100 FOR UPDATE OF o SKIP LOCKED
        ) UPDATE email_outbox o SET status='CANCELLED', encrypted_body=NULL, lease_token=NULL, lease_until=NULL, error_code='EMAIL_TOKEN_UNAVAILABLE', updated_at=NOW() FROM invalid WHERE o.id=invalid.id`;
      const claimed = await serializableWrite(prisma, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT o.id FROM email_outbox o JOIN email_action_tokens t ON t.id=o.token_id JOIN users u ON u.id=t.user_id
          WHERE (o.status='QUEUED' OR (o.status='PROCESSING' AND o.lease_until<=NOW()))
            AND o.available_at<=NOW() AND o.attempts<5 AND t.expires_at>NOW() AND t.consumed_at IS NULL AND u.status='ACTIVE' AND u.auth_version=t.auth_version
            AND (${scopeUserId ?? null}::uuid IS NULL OR u.id=${scopeUserId ?? null}::uuid)
          ORDER BY o.created_at LIMIT 1 FOR UPDATE OF o SKIP LOCKED`;
        if (!rows[0]) return null;
        return tx.emailOutbox.update({
          where: { id: rows[0].id },
          data: {
            status: "PROCESSING",
            attempts: { increment: 1 },
            leaseToken: randomUUID(),
            leaseUntil: new Date(Date.now() + 60000),
            errorCode: null,
          },
        });
      });
      if (!claimed) return false;
      const guard = {
        id: claimed.id,
        status: "PROCESSING",
        leaseToken: claimed.leaseToken,
        leaseUntil: { gt: new Date() },
      };
      try {
        let payload: EmailPayload;
        try {
          payload = JSON.parse(
            decryptEmail(claimed.encryptedBody!, config.keyHex, claimed.id),
          ) as EmailPayload;
        } catch {
          throw new EmailProviderError("EMAIL_OUTBOX_INVALID", false);
        }
        const providerMessageId = await provider.send(claimed.id, payload);
        await prisma.emailOutbox.updateMany({
          where: { ...guard, leaseUntil: { gt: new Date() } },
          data: {
            status: "SENT",
            encryptedBody: null,
            leaseToken: null,
            leaseUntil: null,
            providerMessageId,
            errorCode: null,
          },
        });
      } catch (error) {
        const failure =
          error instanceof EmailProviderError
            ? error
            : new EmailProviderError("EMAIL_PROVIDER_UNAVAILABLE", true);
        const retry = failure.retryable && claimed.attempts < 5;
        await prisma.emailOutbox.updateMany({
          where: { ...guard, leaseUntil: { gt: new Date() } },
          data: {
            status: retry ? "QUEUED" : "FAILED",
            encryptedBody: retry ? claimed.encryptedBody : null,
            leaseToken: null,
            leaseUntil: null,
            errorCode: failure.code,
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
