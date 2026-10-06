import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";

type Session = { accessToken: string };

describe("taste profile API", () => {
  let app: FastifyInstance;
  const suffix = randomUUID();
  const firstEmail = `taste-profile-${suffix}@rec-food.local`;
  const secondEmail = `taste-profile-other-${suffix}@rec-food.local`;
  const invalidEmail = `taste-profile-invalid-${suffix}@rec-food.local`;
  let firstUserId = "";

  const payload = {
    spicyLevel: 30,
    sweetLevel: 45,
    sourLevel: 30,
    saltyLevel: 40,
    budgetMin: 30_000,
    budgetMax: 70_000,
    maxDistanceMeters: 3_500,
    allergies: [{ code: "SHELLFISH", severity: "SEVERE", notes: "Không ăn hải sản" }],
    dietaryRestrictions: [{ code: "VEGAN", isMandatory: true }],
    cuisinePreferences: [{ code: "VIETNAMESE", preferenceScore: 100 }],
  };

  async function registerAndLogin(email: string): Promise<Session> {
    const register = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "taste-profile-password", displayName: "Taste Profile User" },
    });
    expect(register.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "taste-profile-password" },
    });
    expect(login.statusCode).toBe(200);
    return login.json().data as Session;
  }

  beforeAll(async () => {
    app = buildApp({ logger: false, database: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.prisma.user.deleteMany({
      where: { email: { in: [firstEmail, secondEmail, invalidEmail] } },
    });
    await app.close();
  });

  it("lists catalogs, completes onboarding, replaces idempotently, and isolates users", async () => {
    const unauthenticated = await app.inject({ method: "GET", url: "/catalogs/allergens" });
    expect(unauthenticated.statusCode).toBe(401);

    const firstSession = await registerAndLogin(firstEmail);
    const secondSession = await registerAndLogin(secondEmail);

    const catalogs = await app.inject({
      method: "GET",
      url: "/catalogs/cuisines",
      headers: { authorization: `Bearer ${firstSession.accessToken}` },
    });
    expect(catalogs.statusCode).toBe(200);
    const catalogCodes = catalogs.json().data.items.map((item: { code: string }) => item.code);
    expect(catalogCodes).toEqual([...catalogCodes].sort());
    expect(catalogCodes).toContain("VIETNAMESE");

    const catalogMutation = await app.inject({
      method: "POST",
      url: "/catalogs/allergens",
      headers: { authorization: `Bearer ${firstSession.accessToken}` },
      payload: { code: "SHOULD_NOT_BE_CREATED", name: "Invalid" },
    });
    expect(catalogMutation.statusCode).toBe(404);

    const emptyProfile = await app.inject({
      method: "GET",
      url: "/users/me/profile",
      headers: { authorization: `Bearer ${firstSession.accessToken}` },
    });
    expect(emptyProfile.statusCode).toBe(200);
    expect(emptyProfile.json()).toEqual({ data: { profile: null } });

    const onboarding = await app.inject({
      method: "POST",
      url: "/users/me/onboarding",
      headers: { authorization: `Bearer ${firstSession.accessToken}` },
      payload,
    });
    expect(onboarding.statusCode).toBe(200);
    expect(onboarding.json().data.profile).toMatchObject({
      budgetMin: 30_000,
      budgetMax: 70_000,
      maxDistanceMeters: 3_500,
      onboardingCompleted: true,
      allergies: [{ code: "SHELLFISH", severity: "SEVERE" }],
      dietaryRestrictions: [{ code: "VEGAN", isMandatory: true }],
      cuisinePreferences: [{ code: "VIETNAMESE", preferenceScore: 100 }],
    });

    const repeated = await app.inject({
      method: "PUT",
      url: "/users/me/profile",
      headers: { authorization: `Bearer ${firstSession.accessToken}` },
      payload,
    });
    expect(repeated.statusCode).toBe(200);
    firstUserId = (await app.prisma.user.findUniqueOrThrow({ where: { email: firstEmail } })).id;
    expect(await app.prisma.userAllergy.count({ where: { userId: firstUserId } })).toBe(1);
    expect(await app.prisma.userDietaryRestriction.count({ where: { userId: firstUserId } })).toBe(
      1,
    );
    expect(await app.prisma.userCuisinePreference.count({ where: { userId: firstUserId } })).toBe(
      1,
    );

    const otherProfile = await app.inject({
      method: "GET",
      url: "/users/me/profile",
      headers: { authorization: `Bearer ${secondSession.accessToken}` },
    });
    expect(otherProfile.statusCode).toBe(200);
    expect(otherProfile.json()).toEqual({ data: { profile: null } });
  });

  it("rejects invalid onboarding and profile replacement without changing the saved profile", async () => {
    const session = await registerAndLogin(invalidEmail);
    const valid = await app.inject({
      method: "POST",
      url: "/users/me/onboarding",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload,
    });
    expect(valid.statusCode).toBe(200);

    const invalidBudget = await app.inject({
      method: "PUT",
      url: "/users/me/profile",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: { ...payload, budgetMin: 90_000 },
    });
    expect(invalidBudget.statusCode).toBe(400);
    expect(invalidBudget.json().error.code).toBe("INVALID_BUDGET_RANGE");

    const duplicate = await app.inject({
      method: "PUT",
      url: "/users/me/profile",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: {
        ...payload,
        allergies: [
          { code: "SHELLFISH", severity: "SEVERE", notes: null },
          { code: "SHELLFISH", severity: "SEVERE", notes: null },
        ],
      },
    });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json().error.code).toBe("DUPLICATE_SELECTION");

    const unknown = await app.inject({
      method: "PUT",
      url: "/users/me/profile",
      headers: { authorization: `Bearer ${session.accessToken}` },
      payload: {
        ...payload,
        cuisinePreferences: [{ code: "NOT_IN_CATALOG", preferenceScore: 100 }],
      },
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error.code).toBe("UNKNOWN_CATALOG_CODE");

    const afterInvalid = await app.inject({
      method: "GET",
      url: "/users/me/profile",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(afterInvalid.json().data.profile).toMatchObject({
      budgetMin: 30_000,
      budgetMax: 70_000,
    });
  });
});
