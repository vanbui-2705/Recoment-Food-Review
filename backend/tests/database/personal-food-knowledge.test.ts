import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
describe("personal food knowledge", () => {
  const app = buildApp({ logger: false });
  const suffix = randomUUID();
  const emails = [`notes-${suffix}@test.local`, `notes-other-${suffix}@test.local`];
  let headers: { authorization: string };
  let otherHeaders: { authorization: string };
  let userId: string;
  beforeAll(async () => {
    await app.ready();
    const sessions = [];
    for (const email of emails) {
      const register = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "notes-test-password", displayName: "Notes Test" },
      });
      expect(register.statusCode).toBe(201);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "notes-test-password" },
      });
      sessions.push({
        id: register.json().data.user.id,
        headers: { authorization: `Bearer ${login.json().data.accessToken}` },
      });
    }
    userId = sessions[0]!.id;
    headers = sessions[0]!.headers;
    otherHeaders = sessions[1]!.headers;
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });
  const save = (description: string, expectedRevision: number) =>
    app.inject({
      method: "PUT",
      url: "/users/me/food-knowledge",
      headers,
      payload: { description, expectedRevision },
    });
  it("requires authentication, isolates accounts, validates input and stores free text", async () => {
    expect((await app.inject({ url: "/users/me/food-knowledge" })).statusCode).toBe(401);
    expect((await save("   ", 0)).statusCode).toBe(400);
    expect((await save("a".repeat(6001), 0)).statusCode).toBe(400);
    const response = await save("  Tôi thích phở, ít cay. Dị ứng đậu phộng.\nKhông ăn hành.  ", 0);
    expect(response.statusCode).toBe(200);
    expect(response.json().data.knowledge).toMatchObject({
      revision: 1,
      description: "Tôi thích phở, ít cay. Dị ứng đậu phộng.\nKhông ăn hành.",
      analysisStatus: "NOT_ANALYZED",
    });
    expect(response.json().data.knowledge.userId).toBeUndefined();
    const other = await app.inject({ url: "/users/me/food-knowledge", headers: otherHeaders });
    expect(other.json().data.knowledge).toBeNull();
    expect(await app.prisma.tasteProfile.findUnique({ where: { userId } })).toBeNull();
  });
  it("preserves raw input, prevents stale overwrites and tolerates a lost-response retry", async () => {
    const first = await save("Tôi thích cơm, không ăn cay", 1);
    expect(first.json().data.knowledge.revision).toBe(2);
    expect((await save("Tôi thích cơm, không ăn cay", 1)).json().data.knowledge.revision).toBe(2);
    expect((await save("Bản sửa ở tab cũ", 1)).statusCode).toBe(409);
    expect((await save("Tôi thích cơm, không ăn cay", 2)).json().data.knowledge.revision).toBe(2);
    const loaded = await app.inject({ url: "/users/me/food-knowledge", headers });
    expect(loaded.json().data.knowledge.description).toBe("Tôi thích cơm, không ăn cay");
  });
  it("does not use unprocessed input as verified recommendation constraints", async () => {
    for (const url of ["/recommendations/today", "/recipes/today"]) {
      const response = await app.inject({ url, headers });
      expect(response.json().data).toMatchObject({ status: "PROFILE_PENDING_ANALYSIS", items: [] });
    }
    // Simulate a future extractor marking the exact processed revision, without inventing a profile.
    await app.prisma.personalFoodKnowledge.update({
      where: { userId },
      data: { analyzedRevision: 2 },
    });
    expect((await app.inject({ url: "/recommendations/today", headers })).json().data.status).toBe(
      "ONBOARDING_REQUIRED",
    );
    expect((await save("Tôi dị ứng cá", 2)).json().data.knowledge.analysisStatus).toBe(
      "NOT_ANALYZED",
    );
  });
  it("keeps existing structured constraints when a description changes", async () => {
    await app.prisma.tasteProfile.create({
      data: {
        userId,
        spicyLevel: 15,
        sweetLevel: 20,
        sourLevel: 25,
        saltyLevel: 30,
        budgetMin: 30000,
        budgetMax: 80000,
        maxDistanceMeters: 3500,
        onboardingCompleted: true,
      },
    });
    const allergen = await app.prisma.allergen.findFirstOrThrow();
    await app.prisma.userAllergy.create({
      data: { userId, allergenId: allergen.id, severity: "SEVERE" },
    });
    expect((await save("Mô tả mới, vẫn dị ứng cá", 3)).statusCode).toBe(200);
    expect(await app.prisma.tasteProfile.findUnique({ where: { userId } })).toMatchObject({
      spicyLevel: 15,
      budgetMax: 80000,
      onboardingCompleted: true,
    });
    expect(await app.prisma.userAllergy.count({ where: { userId } })).toBe(1);
  });
});
