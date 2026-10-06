import { userErrorMessage } from "./userMessages";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
export const ACCESS_TOKEN_KEY = "eatwise_access_token";

export class ProfileApiError extends Error {
  constructor(message, status = 0, code = "PROFILE_API_ERROR", details = []) {
    super(message);
    this.name = "ProfileApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || "";
}

export function hasLiveSession() {
  return Boolean(getAccessToken());
}

let refreshing = null;
export async function apiRequest(path, options = {}, retry = true) {
  const { responseType, ...fetchOptions } = options;
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ProfileApiError(
      userErrorMessage("NETWORK_ERROR"),
      0,
      "NETWORK_ERROR",
    );
  }

  if (response.ok && responseType === "stream") return response;
  const payload =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshToken =
      retry && window.sessionStorage.getItem("food_refresh_token");
    if (refreshToken) {
      refreshing ||= apiRequest(
        "/auth/refresh",
        { method: "POST", body: JSON.stringify({ refreshToken }) },
        false,
      )
        .then((session) => {
          window.localStorage.setItem(
            ACCESS_TOKEN_KEY,
            session.data.accessToken,
          );
          window.sessionStorage.setItem(
            "food_refresh_token",
            session.data.refreshToken,
          );
        })
        .finally(() => {
          refreshing = null;
        });
      try {
        await refreshing;
        return await apiRequest(path, options, false);
      } catch (error) {
        if (error.status === 401) {
          window.localStorage.removeItem(ACCESS_TOKEN_KEY);
          window.sessionStorage.removeItem("food_refresh_token");
          window.dispatchEvent(new Event("food-session-expired"));
        }
        throw error;
      }
    }
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem("food_refresh_token");
    window.dispatchEvent(new Event("food-session-expired"));
  }
  if (!response.ok) {
    throw new ProfileApiError(
      userErrorMessage(
        payload?.error?.code,
        response.status === 401 && path === "/auth/login" ? 0 : response.status,
        payload?.error?.message,
      ),
      response.status,
      payload?.error?.code || "PROFILE_API_ERROR",
      payload?.error?.details || [],
    );
  }

  return payload;
}

export function fetchProfile() {
  return apiRequest("/users/me/profile");
}

export function fetchCatalogs() {
  return Promise.all([
    apiRequest("/catalogs/allergens"),
    apiRequest("/catalogs/dietary-restrictions"),
    apiRequest("/catalogs/cuisines"),
  ]).then(([allergens, dietaryRestrictions, cuisines]) => ({
    allergens: allergens.data.items,
    dietaryRestrictions: dietaryRestrictions.data.items,
    cuisines: cuisines.data.items,
  }));
}

export function saveOnboarding(profile) {
  return apiRequest("/users/me/onboarding", {
    method: "POST",
    body: JSON.stringify(profile),
  });
}

export function replaceProfile(profile) {
  return apiRequest("/users/me/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export function profileToPayload(profile, overrides = {}) {
  const source = profile || {};
  return {
    latitude: source.latitude ?? null,
    longitude: source.longitude ?? null,
    areaLabel: source.areaLabel ?? null,
    mealPeriod: source.mealPeriod ?? null,
    spicyLevel: source.spicyLevel ?? 30,
    sweetLevel: source.sweetLevel ?? 45,
    sourLevel: source.sourLevel ?? 30,
    saltyLevel: source.saltyLevel ?? 40,
    budgetMin: source.budgetMin ?? 0,
    budgetMax: source.budgetMax ?? 70000,
    maxDistanceMeters: source.maxDistanceMeters ?? 3500,
    allergies: (source.allergies || []).map((item) => ({
      code: item.code,
      severity: item.severity || "SEVERE",
      notes: item.notes ?? null,
    })),
    dietaryRestrictions: (source.dietaryRestrictions || []).map((item) => ({
      code: item.code,
      isMandatory: item.isMandatory ?? true,
    })),
    cuisinePreferences: (source.cuisinePreferences || []).map((item) => ({
      code: item.code,
      preferenceScore: item.preferenceScore ?? 100,
    })),
    ...overrides,
  };
}

export function profileToUiState(profile) {
  return {
    radius: profile?.maxDistanceMeters
      ? String(profile.maxDistanceMeters / 1000)
      : "3.5",
    likes: new Set(
      (profile?.cuisinePreferences || []).map((item) => item.code),
    ),
    allergies: new Set((profile?.allergies || []).map((item) => item.code)),
  };
}
