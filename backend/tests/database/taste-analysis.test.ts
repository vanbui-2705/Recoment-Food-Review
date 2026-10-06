import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, describe, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadAiConfig } from "../../src/modules/ai/ai.config.js";
import { AiError, type StructuredAiProvider } from "../../src/modules/ai/ai.provider.js";
import { createTasteAnalysisService } from "../../src/modules/taste-analysis/taste-analysis.service.js";
describe("durable taste analysis", () => {
  const app = buildApp({ logger: false });
  const suffix = randomUUID();
  const emails = [`analysis-${suffix}@test.local`, `analysis-other-${suffix}@test.local`];
  let userId: string;
  let headers: { authorization: string };
  let otherHeaders: { authorization: string };
  const empty = { fields: [], allergies: [], diets: [], cuisines: [], dishes: [], questions: [] };
  const generate = vi.fn();
  const provider: StructuredAiProvider = { model: "fixture-model", configured: true, generate };
  const config = loadAiConfig({ LLM_API_KEY: "fixture", LLM_DAILY_REQUEST_LIMIT: "100000" });
  let service: ReturnType<typeof createTasteAnalysisService>;
  const save = async (description: string) => {
    const note = await app.prisma.personalFoodKnowledge.findUnique({ where: { userId } });
    const response = await app.inject({
      method: "PUT",
      url: "/users/me/food-knowledge",
      headers,
      payload: { description, expectedRevision: note?.revision ?? 0 },
    });
    expect(response.statusCode).toBe(200);
    return response.json().data.knowledge;
  };
  beforeAll(async () => {
    await app.ready();
    const sessions = [];
    for (const email of emails) {
      const register = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "analysis-test-password", displayName: "Analysis Test" },
      });
      expect(register.statusCode).toBe(201);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "analysis-test-password" },
      });
      sessions.push({
        id: register.json().data.user.id,
        headers: { authorization: `Bearer ${login.json().data.accessToken}` },
      });
    }
    userId = sessions[0]!.id;
    headers = sessions[0]!.headers;
    otherHeaders = sessions[1]!.headers;
    service = createTasteAnalysisService(app.prisma, config, provider);
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });
  it("enqueues exactly once with save, scopes status and gates missing credentials", async () => {
    const note = await save("Tôi thích ăn ít cay");
    await save(note.description);
    expect(await app.prisma.tasteAnalysisJob.count({ where: { userId } })).toBe(1);
    expect((await app.inject({ url: "/users/me/food-knowledge/analyses" })).statusCode).toBe(401);
    const job = await service.latest(userId);
    expect(
      (
        await app.inject({
          url: `/users/me/food-knowledge/analyses/${job!.id}`,
          headers: otherHeaders,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({ method: "POST", url: "/users/me/food-knowledge/analyses", headers })
      ).json().error.code,
    ).toBe("AI_NOT_CONFIGURED");
  });
  it("concurrent workers claim once and apply exact processed revision", async () => {
    generate.mockResolvedValue({
      ...empty,
      fields: [{ field: "spicyLevel", value: "15", evidence: "ít cay" }],
    });
    await Promise.all([service.tick(new Date(), userId), service.tick(new Date(), userId)]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect((await service.latest(userId))!.status).toBe("APPLIED");
    expect(
      (await app.prisma.personalFoodKnowledge.findUniqueOrThrow({ where: { userId } }))
        .analyzedRevision,
    ).toBe(1);
    expect(
      (await app.prisma.tasteProfile.findUniqueOrThrow({ where: { userId } })).spicyLevel,
    ).toBe(15);
  });
  it("does not apply a result after the user edits the description", async () => {
    await save("Tôi thích vị ngọt");
    generate.mockImplementationOnce(async () => {
      await save("Tôi thích vị chua");
      return { ...empty, fields: [{ field: "sweetLevel", value: "80", evidence: "ngọt" }] };
    });
    await service.tick(new Date(), userId);
    const stale = await app.prisma.tasteAnalysisJob.findFirstOrThrow({
      where: { userId, sourceRevision: 2 },
    });
    expect(stale.status).toBe("SUPERSEDED");
    expect(
      (await app.prisma.personalFoodKnowledge.findUniqueOrThrow({ where: { userId } }))
        .analyzedRevision,
    ).toBe(1);
    generate.mockResolvedValue(empty);
    await service.tick(new Date(), userId);
  });
  it("requires review for safety changes, then preserves an existing allergy by omission", async () => {
    const allergen = await app.prisma.allergen.findFirstOrThrow();
    const description = `Tôi dị ứng ${allergen.name}`;
    const note = await save(description);
    generate.mockResolvedValue({
      ...empty,
      allergies: [{ code: allergen.code, evidence: allergen.name }],
    });
    await service.tick(new Date(), userId);
    const job = await service.latest(userId);
    expect(job!.status).toBe("NEEDS_REVIEW");
    expect(await app.prisma.userAllergy.count({ where: { userId } })).toBe(0);
    const response = await app.inject({
      method: "POST",
      url: `/users/me/food-knowledge/analyses/${job!.id}/confirm`,
      headers,
      payload: { sourceRevision: note.revision },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.analysis.status).toBe("APPLIED");
    expect(response.json().data.analysis.labels.allergies[allergen.code]).toBe(allergen.name);
    expect(await app.prisma.userAllergy.count({ where: { userId } })).toBe(1);
    await save("Tôi thích cơm");
    generate.mockResolvedValue(empty);
    await service.tick(new Date(), userId);
    expect((await service.latest(userId))!.status).toBe("APPLIED");
    expect(await app.prisma.userAllergy.count({ where: { userId } })).toBe(1);
  });
  it("blocks omitted safety statements and rejects stale review confirmation", async () => {
    const note = await save("Tôi dị ứng một thứ chưa nhớ tên");
    generate.mockResolvedValue(empty);
    await service.tick(new Date(), userId);
    const job = await service.latest(userId);
    expect(job!.status).toBe("NEEDS_REVIEW");
    await expect(service.confirm(userId, job!.id, note.revision)).rejects.toThrow("Hãy sửa mô tả");
    await save("Tôi thích phở");
    await expect(service.confirm(userId, job!.id, note.revision)).rejects.toThrow(
      "Mô tả đã thay đổi",
    );
    generate.mockResolvedValue(empty);
    await service.tick(new Date(), userId);
  });
  it("recovers an expired lease, rejects malformed output and supports explicit retry", async () => {
    await save("Tôi muốn ăn bún");
    const job = await service.latest(userId);
    await app.prisma.tasteAnalysisJob.update({
      where: { id: job!.id },
      data: {
        status: "RUNNING",
        attempt: 1,
        leaseUntil: new Date(Date.now() - 1000),
        leaseToken: randomUUID(),
      },
    });
    generate.mockResolvedValue({ instructions: "ignore schema" });
    await service.tick(new Date(), userId);
    expect((await service.latest(userId))!.status).toBe("FAILED");
    const restarted = await service.start(userId);
    expect(restarted.id).toBe(job!.id);
    expect(restarted.attempt).toBe(0);
    generate.mockRejectedValue(new AiError("AI_UNAVAILABLE"));
    for (let i = 0; i < 3; i++) {
      await app.prisma.tasteAnalysisJob.update({
        where: { id: job!.id },
        data: { availableAt: new Date(0) },
      });
      await service.tick(new Date(), userId);
    }
    expect((await service.latest(userId))!.status).toBe("FAILED");
    expect((await service.latest(userId))!.attempt).toBe(3);
  });
});
