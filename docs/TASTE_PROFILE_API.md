# Taste Profile API

The first live profile module exposes the onboarding/profile data used by the React wizard and profile screen. All endpoints require the existing access token unless noted otherwise.

## Endpoints

```text
GET  /catalogs/allergens
GET  /catalogs/dietary-restrictions
GET  /catalogs/cuisines
GET  /users/me/profile
PUT  /users/me/profile
POST /users/me/onboarding
```

Catalog responses use `{ data: { items: [...] } }`. Profile reads and mutations use `{ data: { profile: ... } }`; a user who has not started onboarding receives `profile: null`.

Mutation payloads are full replacements. They include taste levels from `0..100`, a non-negative ordered budget range, a positive distance in meters, and arrays of stable catalog codes:

```json
{
  "spicyLevel": 30,
  "sweetLevel": 45,
  "sourLevel": 30,
  "saltyLevel": 40,
  "budgetMin": 30000,
  "budgetMax": 70000,
  "maxDistanceMeters": 3500,
  "allergies": [{ "code": "SHELLFISH", "severity": "SEVERE", "notes": null }],
  "dietaryRestrictions": [{ "code": "VEGAN", "isMandatory": true }],
  "cuisinePreferences": [{ "code": "VIETNAMESE", "preferenceScore": 100 }]
}
```

`POST /users/me/onboarding` sets `onboardingCompleted` only after the complete payload and all catalog codes pass validation. `PUT /users/me/profile` preserves an existing completion flag and replaces all submitted relation rows atomically.

## Frontend boundary

`frontend/src/profileApi.js` owns API paths, auth-token injection, error normalization, DTO mapping and the mock-to-live boundary. The UI calls this adapter only when `localStorage.eatwise_access_token` exists; without a token, the visual prototype stays in preview mode. Set `VITE_API_BASE_URL` when the backend is not running at `http://localhost:3001`.
