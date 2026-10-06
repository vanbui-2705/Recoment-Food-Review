import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEmailConfig } from "../../src/modules/email/email.config.js";
import { decryptEmail } from "../../src/modules/email/email.crypto.js";
import { createEmailService } from "../../src/modules/email/email.service.js";
import { EmailProviderError, type EmailPayload } from "../../src/modules/email/email.provider.js";
import { hashPassword } from "../../src/common/security/password.js";
import { signAccessToken } from "../../src/common/security/token.js";
import { loadEnv } from "../../src/config/env.js";
const app = buildApp({ logger: false }),
  ids: string[] = [];
const settings = {
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "test-only-no-send",
  EMAIL_FROM: "support@example.com",
  PUBLIC_APP_URL: "https://app.example.com",
  EMAIL_ALLOWED_ORIGINS: "https://app.example.com",
  EMAIL_OUTBOX_ENCRYPTION_KEY: "22".repeat(32),
};
const config = loadEmailConfig(settings),
  sent = vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111");
const service = () => createEmailService(app.prisma, config, { configured: true, send: sent });
async function owner() {
  const user = await app.prisma.user.create({
    data: {
      email: `email-${randomUUID()}@rec-food.local`,
      displayName: "Email test",
      passwordHash: await hashPassword("original-password"),
    },
  });
  ids.push(user.id);
  return user;
}
async function queued(userId: string, purpose = "RESET") {
  const row = await app.prisma.emailActionToken.findFirstOrThrow({
    where: { userId, purpose },
    include: { outbox: true },
    orderBy: { createdAt: "desc" },
  });
  const payload = JSON.parse(
    decryptEmail(row.outbox!.encryptedBody!, config.keyHex, row.outbox!.id),
  ) as EmailPayload;
  const token = /#(?:reset-password|verify-email)\/([A-Za-z0-9_-]{43})/.exec(payload.text)![1]!;
  return { row, payload, token };
}
beforeAll(async () => {
  for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
  await app.ready();
});
afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app.close();
  vi.unstubAllEnvs();
});
it("returns the same accepted response for known/unknown email, deduplicates rapid requests and stores no plaintext", async () => {
  const user = await owner();
  const known = await app.inject({
    method: "POST",
    url: "/auth/forgot-password",
    payload: { email: user.email },
  });
  const unknown = await app.inject({
    method: "POST",
    url: "/auth/forgot-password",
    payload: { email: "unknown@example.com" },
  });
  expect(known.statusCode).toBe(200);
  expect(known.json()).toEqual(unknown.json());
  await service().enqueue(user.email, "RESET");
  expect(
    await app.prisma.emailActionToken.count({ where: { userId: user.id, purpose: "RESET" } }),
  ).toBe(1);
  const { row, token } = await queued(user.id);
  expect(row.tokenHash).not.toBe(token);
  expect(JSON.stringify(row)).not.toContain(token);
  expect(row.outbox!.encryptedBody).not.toContain(user.email);
});
it("consumes reset once under concurrency and invalidates access/refresh before allowing a new login", async () => {
  const user = await owner();
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: user.email, password: "original-password" },
  });
  expect(login.statusCode).toBe(200);
  const session = login.json().data;
  await service().enqueue(user.email, "RESET");
  const { token } = await queued(user.id);
  const results = await Promise.all(
    [1, 2].map(() =>
      app.inject({
        method: "POST",
        url: "/auth/reset-password",
        payload: { token, newPassword: "replacement-password" },
      }),
    ),
  );
  expect(results.map((r) => r.statusCode).sort()).toEqual([204, 410]);
  expect(
    (
      await app.inject({
        url: "/users/me",
        headers: { authorization: `Bearer ${session.accessToken}` },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: { refreshToken: session.refreshToken },
      })
    ).statusCode,
  ).toBe(401);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: user.email, password: "replacement-password" },
      })
    ).statusCode,
  ).toBe(200);
});
it("isolates verify/reset purposes, rejects expired links and cancels encrypted undelivered payloads", async () => {
  const user = await owner();
  await service().enqueue(user.email, "VERIFY");
  const verify = await queued(user.id, "VERIFY");
  await expect(
    service().consume(verify.token, "RESET", "replacement-password"),
  ).rejects.toMatchObject({ code: "EMAIL_LINK_INVALID" });
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/auth/verify-email",
        payload: { token: verify.token },
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/auth/verify-email",
        payload: { token: verify.token },
      })
    ).statusCode,
  ).toBe(410);
  expect(
    (await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt,
  ).not.toBeNull();
  await service().enqueue(user.email, "RESET");
  const reset = await queued(user.id);
  await app.prisma.emailActionToken.update({
    where: { id: reset.row.id },
    data: { createdAt: new Date(Date.now() - 3600000), expiresAt: new Date(Date.now() - 60000) },
  });
  await expect(
    service().consume(reset.token, "RESET", "replacement-password"),
  ).rejects.toMatchObject({ code: "EMAIL_LINK_INVALID" });
  await service().tick(user.id);
  const rows = await app.prisma.emailOutbox.findMany({ where: { token: { userId: user.id } } });
  expect(rows.every((row) => row.status === "CANCELLED" && row.encryptedBody === null)).toBe(true);
});
it("reclaims an expired worker lease only once, retries identical delivery and clears encrypted content after success", async () => {
  const user = await owner();
  await service().enqueue(user.email, "RESET");
  const queuedItem = await queued(user.id);
  sent.mockClear();
  sent.mockRejectedValueOnce(new EmailProviderError("EMAIL_PROVIDER_BUSY", true));
  await service().tick(user.id);
  expect(
    (await app.prisma.emailOutbox.findUniqueOrThrow({ where: { id: queuedItem.row.outbox!.id } }))
      .status,
  ).toBe("QUEUED");
  await app.prisma.emailOutbox.update({
    where: { id: queuedItem.row.outbox!.id },
    data: {
      status: "PROCESSING",
      leaseToken: randomUUID(),
      leaseUntil: new Date(Date.now() - 1000),
      availableAt: new Date(Date.now() - 1000),
    },
  });
  const claims = await Promise.all([service().tick(user.id), service().tick(user.id)]);
  expect(claims.sort()).toEqual([false, true]);
  expect(sent).toHaveBeenCalledTimes(2);
  expect(sent.mock.calls[0]).toEqual(sent.mock.calls[1]);
  const delivered = await app.prisma.emailOutbox.findUniqueOrThrow({
    where: { id: queuedItem.row.outbox!.id },
  });
  expect(delivered.status).toBe("SENT");
  expect(delivered.encryptedBody).toBeNull();
  expect(delivered.leaseToken).toBeNull();
});
it("resends only for the authenticated owner, limits spam and returns controlled unconfigured responses", async () => {
  const user = await owner(),
    headers = {
      authorization: `Bearer ${await signAccessToken({ userId: user.id, role: "USER" }, loadEnv().jwtAccessSecret, 300)}`,
    };
  expect((await app.inject({ method: "POST", url: "/auth/resend-verification" })).statusCode).toBe(
    401,
  );
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/auth/resend-verification",
        headers,
        remoteAddress: "10.20.30.1",
      })
    ).statusCode,
  ).toBe(200);
  expect(
    await app.prisma.emailActionToken.count({ where: { userId: user.id, purpose: "VERIFY" } }),
  ).toBe(1);
  for (let index = 0; index < 5; index++)
    await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: "unknown@example.com" },
      remoteAddress: "10.20.30.2",
    });
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email: user.email },
        remoteAddress: "10.20.30.2",
      })
    ).statusCode,
  ).toBe(429);
  vi.stubEnv("EMAIL_PROVIDER", "disabled");
  const disabled = buildApp({ logger: false });
  try {
    for (const email of [user.email, "unknown@example.com"]) {
      const response = await disabled.inject({
        method: "POST",
        url: "/auth/forgot-password",
        payload: { email },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe("EMAIL_NOT_CONFIGURED");
    }
  } finally {
    await disabled.close();
    vi.stubEnv("EMAIL_PROVIDER", "resend");
  }
});
