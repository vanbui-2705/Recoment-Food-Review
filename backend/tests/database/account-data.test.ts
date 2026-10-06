import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { hashPassword } from "../../src/common/security/password.js";
import { signAccessToken } from "../../src/common/security/token.js";
import { loadEnv } from "../../src/config/env.js";
import { createAccountService } from "../../src/modules/account/account.service.js";
import { createRetentionService } from "../../src/modules/account/account.retention.js";
import { prepareExport } from "../../src/modules/account/account.export.js";
const app = buildApp({ logger: false }),
  ids: string[] = [],
  reportIds: string[] = [];
let passwordHash: string;
async function owner() {
  const user = await app.prisma.user.create({
    data: { email: `data-${randomUUID()}@rec-food.local`, displayName: "Data owner", passwordHash },
  });
  ids.push(user.id);
  return {
    ...user,
    headers: {
      authorization: `Bearer ${await signAccessToken({ userId: user.id, role: "USER" }, loadEnv().jwtAccessSecret, 300)}`,
    },
  };
}
beforeAll(async () => {
  vi.stubEnv("WORKER_ENABLED", "true");
  await app.ready();
  passwordHash = await hashPassword("data-password");
});
afterAll(async () => {
  await app.prisma.dataReport.deleteMany({ where: { id: { in: reportIds } } });
  await app.prisma.user.deleteMany({ where: { id: { in: ids } } });
  await app.prisma.maintenanceLease.deleteMany({
    where: { name: { in: ids.map((id) => `retention-test:${id}`) } },
  });
  await app.close();
  vi.unstubAllEnvs();
});
it("requires reauthentication and exports only owner data without hashes, credentials or provider content", async () => {
  const user = await owner(),
    other = await owner();
  await app.prisma.personalFoodKnowledge.create({
    data: { userId: user.id, description: "Own taste note" },
  });
  await app.prisma.personalFoodKnowledge.create({
    data: { userId: other.id, description: "Other private taste note" },
  });
  await app.prisma.recipeInteraction.create({
    data: {
      userId: user.id,
      source: "themealdb",
      recipeId: "13",
      title: "provider-content-do-not-export",
      canonicalName: "recipe:themealdb:13",
      interactionType: "CHOSEN",
      idempotencyKey: randomUUID(),
    },
  });
  const url = "/users/me/export",
    remoteAddress = "10.40.0.1";
  expect(
    (
      await app.inject({
        method: "POST",
        url,
        headers: user.headers,
        remoteAddress,
        payload: { currentPassword: "wrong-password" },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "POST",
        url,
        headers: user.headers,
        remoteAddress,
        payload: { currentPassword: "data-password", userId: other.id },
      })
    ).statusCode,
  ).toBe(400);
  const result = await app.inject({
    method: "POST",
    url,
    headers: user.headers,
    remoteAddress,
    payload: { currentPassword: "data-password" },
  });
  expect(result.statusCode).toBe(200);
  expect(result.headers["cache-control"]).toBe("no-store");
  expect(result.headers["content-type"]).toContain("application/x-ndjson");
  const rows = result.body
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(rows.at(-1).type).toBe("complete");
  expect(result.body).toContain("Own taste note");
  for (const secret of [
    other.id,
    other.email,
    "Other private taste note",
    passwordHash,
    "provider-content-do-not-export",
    "tokenHash",
    "passwordHash",
    "apiKey",
    "encryptedBody",
    "ipAddress",
  ])
    expect(result.body).not.toContain(secret);
  expect(rows.some((row) => row.type === "recipe-history" && row.data.recipeId === "13")).toBe(
    true,
  );
  const staleExport = await prepareExport(app.prisma, user.id, "data-password");
  await app.prisma.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
  await expect(staleExport().next()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
it("stops export when its session family is revoked while another device remains active", async () => {
  const user = await owner(),
    familyId = randomUUID(),
    otherFamily = randomUUID();
  await app.prisma.refreshToken.createMany({
    data: [familyId, otherFamily].map((id) => ({
      userId: user.id,
      familyId: id,
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 60000),
    })),
  });
  const exportRows = await prepareExport(app.prisma, user.id, "data-password", familyId);
  const iterator = exportRows();
  expect((await iterator.next()).value).toContain('"type":"export"');
  expect((await iterator.next()).value).toContain('"type":"account"');
  await app.prisma.refreshToken.updateMany({
    where: { familyId },
    data: { revokedAt: new Date() },
  });
  await expect(iterator.next()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  const unaffected = await prepareExport(app.prisma, user.id, "data-password", otherFamily);
  expect((await unaffected().next()).value).toContain('"type":"export"');
});
it("confirms deletion, revokes immediately, anonymizes reports/audit and never deletes another account", async () => {
  const user = await owner(),
    other = await owner(),
    remoteAddress = "10.40.0.2";
  const report = await app.prisma.dataReport.create({
    data: {
      userId: user.id,
      targetKind: "PLACE",
      targetSource: "google",
      targetId: "public-provider-id",
      reason: "WRONG_ADDRESS",
      note: user.email,
      idempotencyKey: `${user.id}:${randomUUID()}`,
      inputHash: "1".repeat(64),
    },
  });
  reportIds.push(report.id);
  await app.prisma.reportReview.create({
    data: {
      reportId: report.id,
      actorId: other.id,
      fromStatus: "OPEN",
      toStatus: "IN_REVIEW",
      reason: `mentions ${user.email}`,
    },
  });
  await app.prisma.adminAudit.create({
    data: {
      actorId: other.id,
      action: "USER_STATUS_REVIEW",
      targetId: user.id,
      metadata: { from: "DISABLED", to: "ACTIVE" },
    },
  });
  const keptAudit = await app.prisma.adminAudit.create({
    data: {
      actorId: other.id,
      action: "SYNTHETIC_TEST_EVENT",
      targetId: other.id,
      metadata: { keep: true },
    },
  });
  const url = "/users/me/account",
    payload = { currentPassword: "data-password", confirm: true, confirmation: "XÓA TÀI KHOẢN" };
  expect(
    (
      await app.inject({
        method: "DELETE",
        url,
        headers: user.headers,
        remoteAddress,
        payload: { ...payload, confirmation: "wrong" },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: "DELETE",
        url,
        headers: user.headers,
        remoteAddress,
        payload: { ...payload, currentPassword: "wrong-password" },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await app.inject({
        method: "DELETE",
        url,
        headers: user.headers,
        remoteAddress,
        payload: { ...payload, userId: other.id },
      })
    ).statusCode,
  ).toBe(400);
  const requested = await app.inject({
    method: "DELETE",
    url,
    headers: user.headers,
    remoteAddress,
    payload,
  });
  expect(requested.statusCode).toBe(202);
  expect(requested.json().data.status).toBe("DELETION_QUEUED");
  expect((await app.inject({ url: "/users/me", headers: user.headers })).statusCode).toBe(401);
  expect((await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe(
    "DISABLED",
  );
  expect(await createAccountService(app.prisma, true).tick(user.id)).toBe(true);
  expect(await app.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  expect(await app.prisma.accountDeletionJob.findUnique({ where: { userId: user.id } })).toBeNull();
  expect(
    await app.prisma.adminAudit.count({
      where: { OR: [{ actorId: user.id }, { targetId: user.id }] },
    }),
  ).toBe(0);
  const anonymized = await app.prisma.dataReport.findUniqueOrThrow({
    where: { id: report.id },
    include: { reviews: true },
  });
  expect(anonymized.userId).toBeNull();
  expect(anonymized.note).not.toContain(user.email);
  expect(anonymized.idempotencyKey).not.toContain(user.id);
  expect(anonymized.inputHash).toBe("0".repeat(64));
  expect(anonymized.reviews.every((review) => !review.reason.includes(user.email))).toBe(true);
  expect(await app.prisma.user.findUnique({ where: { id: other.id } })).not.toBeNull();
  expect(
    (await app.prisma.adminAudit.findUniqueOrThrow({ where: { id: keptAudit.id } })).metadata,
  ).toEqual({ keep: true });
  await expect(
    app.prisma.adminAudit.update({
      where: { id: keptAudit.id },
      data: { metadata: { tamper: true } },
    }),
  ).rejects.toThrow();
});
it("recovers an abandoned deletion lease with one successful cleanup across workers", async () => {
  const user = await owner(),
    service = createAccountService(app.prisma, true);
  const queued = await service.requestDeletion(user.id, "data-password");
  await app.prisma.accountDeletionJob.update({
    where: { userId: user.id },
    data: {
      status: "RUNNING",
      attempts: 1,
      leaseToken: randomUUID(),
      leaseUntil: new Date(Date.now() - 1000),
    },
  });
  const claims = await Promise.all([service.tick(user.id), service.tick(user.id)]);
  expect(claims.sort()).toEqual([false, true]);
  expect(await app.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  expect(
    await app.prisma.adminAudit.count({
      where: {
        action: "ACCOUNT_DELETED",
        metadata: { path: ["requestId"], equals: queued.requestId },
      },
    }),
  ).toBe(1);
});
it("preserves the 96-hour cooldown during bounded retention and leaves fresh notes and other accounts intact", async () => {
  const user = await owner(),
    other = await owner();
  const days = (n: number) => new Date(Date.now() - n * 86400000);
  const record = (userId: string, n: number) => ({
    userId,
    source: "themealdb",
    recipeId: randomUUID().slice(0, 8),
    title: "Own history",
    canonicalName: "canonical meal",
    interactionType: "EATEN" as const,
    idempotencyKey: randomUUID(),
    createdAt: days(n),
  });
  const old = await app.prisma.recipeInteraction.create({ data: record(user.id, 181) });
  const recent = await app.prisma.recipeInteraction.create({ data: record(user.id, 2) });
  const otherOld = await app.prisma.recipeInteraction.create({ data: record(other.id, 181) });
  await app.prisma.personalFoodKnowledge.create({
    data: {
      userId: user.id,
      description: "Unprocessed safety note",
      revision: 1,
      analyzedRevision: 0,
    },
  });
  const convo = await app.prisma.conversation.create({
    data: { userId: user.id, title: "Old conversation", createdAt: days(91), updatedAt: days(91) },
  });
  const request = await app.prisma.recommendationRequest.create({
    data: {
      userId: user.id,
      requestedAt: days(91),
      latitude: 10.77,
      longitude: 106.7,
      status: "SUCCESS",
    },
  });
  const queuedConvo = await app.prisma.conversation.create({
    data: { userId: user.id, title: "Abandoned queue", createdAt: days(91), updatedAt: days(91) },
  });
  const runningConvo = await app.prisma.conversation.create({
    data: { userId: user.id, title: "Active lease", createdAt: days(91), updatedAt: days(91) },
  });
  for (const [conversationId, active] of [
    [queuedConvo.id, false],
    [runningConvo.id, true],
  ] as const) {
    const message = await app.prisma.chatMessage.create({
      data: { conversationId, role: "USER", content: "Old question", createdAt: days(91) },
    });
    await app.prisma.chatRun.create({
      data: {
        conversationId,
        messageId: message.id,
        idempotencyKey: randomUUID(),
        inputHash: "1".repeat(64),
        context: {},
        status: active ? "RUNNING" : "QUEUED",
        attempts: active ? 1 : 0,
        leaseToken: active ? randomUUID() : null,
        leaseUntil: active ? new Date(Date.now() + 60000) : null,
      },
    });
  }
  const oldAudit = await app.prisma.adminAudit.create({
    data: {
      actorId: user.id,
      action: "SYNTHETIC_RETENTION_EVENT",
      targetId: user.id,
      metadata: {},
      createdAt: days(366),
    },
  });
  const service = createRetentionService(app.prisma, true);
  const runs = await Promise.all([service.tick(user.id), service.tick(user.id)]);
  expect(runs.sort()).toEqual([false, true]);
  expect(await app.prisma.recipeInteraction.findUnique({ where: { id: old.id } })).toBeNull();
  expect(
    await app.prisma.recipeInteraction.findUnique({ where: { id: recent.id } }),
  ).not.toBeNull();
  expect(
    await app.prisma.recipeInteraction.findUnique({ where: { id: otherOld.id } }),
  ).not.toBeNull();
  expect(await app.prisma.conversation.findUnique({ where: { id: convo.id } })).toBeNull();
  expect(await app.prisma.conversation.findUnique({ where: { id: queuedConvo.id } })).toBeNull();
  expect(
    await app.prisma.conversation.findUnique({ where: { id: runningConvo.id } }),
  ).not.toBeNull();
  expect(
    await app.prisma.recommendationRequest.findUnique({ where: { id: request.id } }),
  ).toBeNull();
  expect(await app.prisma.adminAudit.findUnique({ where: { id: oldAudit.id } })).toBeNull();
  expect(
    await app.prisma.personalFoodKnowledge.findUnique({ where: { userId: user.id } }),
  ).toMatchObject({ analyzedRevision: 0, revision: 1 });
  expect(await service.tick(user.id)).toBe(false);
});
it("does not alter an account when deletion processing is disabled", async () => {
  const user = await owner();
  await expect(
    createAccountService(app.prisma, false).requestDeletion(user.id, "data-password"),
  ).rejects.toMatchObject({ code: "ACCOUNT_DELETION_UNAVAILABLE" });
  expect((await app.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).status).toBe(
    "ACTIVE",
  );
});
