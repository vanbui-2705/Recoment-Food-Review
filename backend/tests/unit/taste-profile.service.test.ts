import { describe, expect, it, vi } from "vitest";

import type { TasteProfileRepository } from "../../src/modules/taste-profile/taste-profile.repository.js";
import { createTasteProfileService } from "../../src/modules/taste-profile/taste-profile.service.js";
import type { ProfilePayload } from "../../src/modules/taste-profile/taste-profile.schema.js";

const basePayload: ProfilePayload = {
  spicyLevel: 30,
  sweetLevel: 45,
  sourLevel: 30,
  saltyLevel: 40,
  budgetMin: 30_000,
  budgetMax: 70_000,
  maxDistanceMeters: 3_500,
  allergies: [{ code: " shellfish ", severity: "SEVERE", notes: null }],
  dietaryRestrictions: [{ code: "vegan", isMandatory: true }],
  cuisinePreferences: [{ code: "vietnamese", preferenceScore: 100 }],
};

function storedProfile() {
  return {
    profile: {
      spicyLevel: 30,
      sweetLevel: 45,
      sourLevel: 30,
      saltyLevel: 40,
      budgetMin: 30_000,
      budgetMax: 70_000,
      maxDistanceMeters: 3_500,
      onboardingCompleted: true,
    },
    allergies: [
      {
        code: "SHELLFISH",
        name: "Shellfish",
        description: null,
        severity: "SEVERE" as const,
        notes: null,
      },
    ],
    dietaryRestrictions: [
      {
        code: "VEGAN",
        name: "Vegan",
        description: null,
        isMandatory: true,
      },
    ],
    cuisinePreferences: [
      {
        code: "VIETNAMESE",
        name: "Vietnamese",
        description: null,
        preferenceScore: 100,
      },
    ],
  };
}

function createRepositoryMock(): TasteProfileRepository {
  return {
    listAllergens: vi
      .fn()
      .mockResolvedValue([
        { id: "allergen-1", code: "SHELLFISH", name: "Shellfish", description: null },
      ]),
    listDietaryRestrictions: vi
      .fn()
      .mockResolvedValue([{ id: "diet-1", code: "VEGAN", name: "Vegan", description: null }]),
    listCuisines: vi
      .fn()
      .mockResolvedValue([
        { id: "cuisine-1", code: "VIETNAMESE", name: "Vietnamese", description: null },
      ]),
    findProfile: vi.fn().mockResolvedValue(null),
    replaceProfile: vi.fn().mockResolvedValue(storedProfile()),
  };
}

describe("taste profile service", () => {
  it("returns a normalized profile and resolves case-insensitive catalog codes", async () => {
    const repository = createRepositoryMock();
    const service = createTasteProfileService(repository);

    const result = await service.saveProfile("user-1", basePayload, true);

    expect(result.onboardingCompleted).toBe(true);
    expect(repository.replaceProfile).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        allergies: [{ code: "SHELLFISH", severity: "SEVERE", notes: null }],
        dietaryRestrictions: [{ code: "VEGAN", isMandatory: true }],
        cuisinePreferences: [{ code: "VIETNAMESE", preferenceScore: 100 }],
      }),
      {
        allergenIds: ["allergen-1"],
        dietaryRestrictionIds: ["diet-1"],
        cuisineIds: ["cuisine-1"],
      },
      true,
    );
  });

  it("sorts catalog responses by stable code", async () => {
    const repository = createRepositoryMock();
    vi.mocked(repository.listCuisines).mockResolvedValue([
      { id: "2", code: "VIETNAMESE", name: "Vietnamese", description: null },
      { id: "1", code: "CHINESE", name: "Chinese", description: null },
    ]);
    const service = createTasteProfileService(repository);

    await expect(service.listCatalog("cuisines")).resolves.toEqual([
      { code: "CHINESE", name: "Chinese", description: null },
      { code: "VIETNAMESE", name: "Vietnamese", description: null },
    ]);
  });

  it("rejects invalid budgets before catalog resolution or writes", async () => {
    const repository = createRepositoryMock();
    const service = createTasteProfileService(repository);

    await expect(
      service.saveProfile("user-1", { ...basePayload, budgetMin: 80_000 }, false),
    ).rejects.toMatchObject({
      code: "INVALID_BUDGET_RANGE",
      statusCode: 400,
    });
    expect(repository.replaceProfile).not.toHaveBeenCalled();
    expect(repository.listAllergens).not.toHaveBeenCalled();
  });

  it("rejects duplicate and unknown selections without writing", async () => {
    const repository = createRepositoryMock();
    const service = createTasteProfileService(repository);

    await expect(
      service.saveProfile(
        "user-1",
        {
          ...basePayload,
          allergies: [
            { code: "SHELLFISH", severity: "SEVERE", notes: null },
            { code: "shellfish", severity: "SEVERE", notes: null },
          ],
        },
        false,
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_SELECTION" });
    expect(repository.replaceProfile).not.toHaveBeenCalled();

    await expect(
      service.saveProfile(
        "user-1",
        { ...basePayload, cuisinePreferences: [{ code: "UNKNOWN", preferenceScore: 100 }] },
        false,
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_CATALOG_CODE" });
    expect(repository.replaceProfile).not.toHaveBeenCalled();
  });
});
