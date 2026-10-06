import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { createHistoryService } from "../../src/modules/history/history.service.js";
describe("private history pagination and confirmed deletion", () => {
  const app = buildApp({ logger: false });
  const suffix = randomUUID();
  let userId: string, otherId: string, dishId: string;
  let headers: { authorization: string }, other: { authorization: string };
  beforeAll(async () => {
    await app.ready();
    const sessions = [];
    for (const prefix of ["owner", "other"]) {
      const email = `${prefix}-history-${suffix}@test.local`;
      const registered = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { email, password: "history-test-password", displayName: "History Test" },
      });
      expect(registered.statusCode).toBe(201);
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email, password: "history-test-password" },
      });
      sessions.push({
        id: registered.json().data.user.id as string,
        headers: { authorization: `Bearer ${login.json().data.accessToken}` },
      });
    }
    userId = sessions[0]!.id;
    headers = sessions[0]!.headers;
    otherId = sessions[1]!.id;
    other = sessions[1]!.headers;
    dishId = (
      await app.prisma.dish.create({
        data: {
          slug: `history-${suffix}`,
          name: `History ${suffix}`,
          cuisineId: (await app.prisma.cuisine.findFirstOrThrow()).id,
          spicyLevel: 0,
          sweetLevel: 0,
          sourLevel: 0,
          saltyLevel: 0,
          priceMin: 1000,
          priceMax: 50000,
        },
      })
    ).id;
  });
  afterAll(async () => {
    await app.prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await app.prisma.dish.deleteMany({ where: { id: dishId } });
    await app.close();
  });
  it("paginates equal timestamps across both sources without duplicates and validates cursor", async () => {
    const at = new Date();
    await app.prisma.userInteraction.createMany({
      data: Array.from({ length: 3 }, () => ({
        userId,
        dishId,
        interactionType: "CHOSEN" as const,
        createdAt: at,
        idempotencyKey: randomUUID(),
      })),
    });
    await app.prisma.recipeInteraction.createMany({
      data: Array.from({ length: 3 }, () => ({
        userId,
        source: "themealdb",
        recipeId: "1",
        title: "Recipe",
        canonicalName: "recipe",
        interactionType: "EATEN" as const,
        createdAt: at,
        idempotencyKey: randomUUID(),
      })),
    });
    const service = createHistoryService(app.prisma),
      ids = [];
    let cursor: string | undefined;
    do {
      const result = await service.list(userId, { limit: 2, cursor });
      ids.push(...result.items.map((row) => row.id));
      cursor = result.nextCursor ?? undefined;
    } while (cursor);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    expect((await service.list(otherId, {})).items).toEqual([]);
    expect(
      (await app.inject({ method: "GET", url: "/users/me/history?cursor=invalid", headers }))
        .statusCode,
    ).toBe(400);
    expect((await service.list(userId, { kind: "RECIPE", type: "EATEN" })).items).toHaveLength(3);
  });
  it("requires owner confirmation and rejects a stale cooldown preview", async () => {
    const row = await app.prisma.userInteraction.findFirstOrThrow({ where: { userId, dishId } });
    const path = `/users/me/history/DISH/${row.id}`;
    const preview = await app.inject({ method: "GET", url: `${path}/deletion-preview`, headers });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().data.remainingCooldownRecords).toBe(2);
    expect(
      (await app.inject({ method: "GET", url: `${path}/deletion-preview`, headers: other }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: path,
          headers,
          payload: { confirm: false, expectedVersion: preview.json().data.expectedVersion },
        })
      ).statusCode,
    ).toBe(400);
    await app.prisma.userInteraction.create({
      data: { userId, dishId, interactionType: "EATEN", idempotencyKey: randomUUID() },
    });
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: path,
          headers,
          payload: { confirm: true, expectedVersion: preview.json().data.expectedVersion },
        })
      ).statusCode,
    ).toBe(409);
    const latest = await app.inject({ method: "GET", url: `${path}/deletion-preview`, headers });
    const deleted = await app.inject({
      method: "DELETE",
      url: path,
      headers,
      payload: { confirm: true, expectedVersion: latest.json().data.expectedVersion },
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data.eligibleAgainAt).not.toBeNull();
    expect(
      (await app.inject({ method: "GET", url: `${path}/deletion-preview`, headers })).statusCode,
    ).toBe(404);
  });
  it("validates owned rating semantics, deduplicates concurrent feedback and previews cascade deletion", async () => {
    const row = await app.prisma.userInteraction.findFirstOrThrow({ where: { userId, dishId } });
    const path = `/users/me/history/DISH/${row.id}/feedback`;
    const body = { type: "RATED", rating: 5, idempotencyKey: randomUUID() };
    const rated = await Promise.all([
      app.inject({ method: "POST", url: path, headers, payload: body }),
      app.inject({ method: "POST", url: path, headers, payload: body }),
    ]);
    expect(rated.map((result) => result.statusCode)).toEqual([200, 200]);
    expect(rated[0]!.json().data.id).toBe(rated[1]!.json().data.id);
    expect(
      (await app.inject({ method: "POST", url: path, headers: other, payload: body })).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "POST", url: path, headers, payload: { ...body, rating: 4 } }))
        .statusCode,
    ).toBe(409);
    for (const invalid of [
      { ...body, rating: 0 },
      { ...body, rating: 6 },
      { ...body, type: "LIKED" },
      { type: "RATED", idempotencyKey: randomUUID() },
    ])
      expect(
        (await app.inject({ method: "POST", url: path, headers, payload: invalid })).statusCode,
      ).toBe(400);
    const previewPath = `/users/me/history/DISH/${row.id}/deletion-preview`;
    const preview = (await app.inject({ method: "GET", url: previewPath, headers })).json().data;
    expect(preview.linkedFeedbackCount).toBe(1);
    const changed = await app.inject({
      method: "POST",
      url: path,
      headers,
      payload: { type: "LIKED", idempotencyKey: randomUUID() },
    });
    expect(changed.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/users/me/history/DISH/${row.id}`,
          headers,
          payload: { confirm: true, expectedVersion: preview.expectedVersion },
        })
      ).statusCode,
    ).toBe(409);
    const latest = (await app.inject({ method: "GET", url: previewPath, headers })).json().data;
    expect(latest.linkedFeedbackCount).toBe(2);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/users/me/history/DISH/${row.id}`,
          headers,
          payload: { confirm: true, expectedVersion: latest.expectedVersion },
        })
      ).statusCode,
    ).toBe(200);
    expect(await app.prisma.userInteraction.count({ where: { feedbackOfId: row.id } })).toBe(0);
  });
});
