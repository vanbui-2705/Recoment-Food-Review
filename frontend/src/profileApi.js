const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
export const ACCESS_TOKEN_KEY = 'eatwise_access_token';

export class ProfileApiError extends Error {
  constructor(message, status = 0, code = 'PROFILE_API_ERROR', details = []) {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function hasLiveSession() {
  return Boolean(getAccessToken());
}

async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new ProfileApiError('Không kết nối được tới Rec-Food API', 0, 'NETWORK_ERROR', [error]);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ProfileApiError(
      payload?.error?.message || 'Không thể xử lý yêu cầu hồ sơ',
      response.status,
      payload?.error?.code || 'PROFILE_API_ERROR',
      payload?.error?.details || [],
    );
  }

  return payload;
}

export function fetchProfile() {
  return apiRequest('/users/me/profile');
}

export function fetchCatalogs() {
  return Promise.all([
    apiRequest('/catalogs/allergens'),
    apiRequest('/catalogs/dietary-restrictions'),
    apiRequest('/catalogs/cuisines'),
  ]).then(([allergens, dietaryRestrictions, cuisines]) => ({
    allergens: allergens.data.items,
    dietaryRestrictions: dietaryRestrictions.data.items,
    cuisines: cuisines.data.items,
  }));
}

export function saveOnboarding(profile) {
  return apiRequest('/users/me/onboarding', { method: 'POST', body: JSON.stringify(profile) });
}

export function replaceProfile(profile) {
  return apiRequest('/users/me/profile', { method: 'PUT', body: JSON.stringify(profile) });
}

export function profileToPayload(profile, overrides = {}) {
  const source = profile || {};
  return {
    spicyLevel: source.spicyLevel ?? 30,
    sweetLevel: source.sweetLevel ?? 45,
    sourLevel: source.sourLevel ?? 30,
    saltyLevel: source.saltyLevel ?? 40,
    budgetMin: source.budgetMin ?? 0,
    budgetMax: source.budgetMax ?? 70000,
    maxDistanceMeters: source.maxDistanceMeters ?? 3500,
    allergies: (source.allergies || []).map((item) => ({
      code: item.code,
      severity: item.severity || 'SEVERE',
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
    radius: profile?.maxDistanceMeters ? String(profile.maxDistanceMeters / 1000) : '3.5',
    likes: new Set((profile?.cuisinePreferences || []).map((item) => item.code)),
    allergies: new Set((profile?.allergies || []).map((item) => item.code)),
  };
}
