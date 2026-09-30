## Context

The database already contains `TasteProfile`, `UserAllergy`, `UserDietaryRestriction`, `UserCuisinePreference` and normalized catalog models with the required uniqueness and range constraints. The backend already uses Fastify, TypeBox, Prisma and `app.authenticate`; `/users/me` establishes the existing route and response conventions. The React UI is currently a mock-driven single-page prototype, so the integration must keep the visual flow intact while moving profile state behind an API boundary.

## Goals / Non-Goals

**Goals:**

- Provide a stable API contract for profile retrieval, replacement and onboarding completion.
- Preserve hard-constraint semantics for allergies and mandatory dietary restrictions.
- Make profile replacement atomic and safe to retry.
- Reuse existing Prisma constraints and catalog seed data without introducing a second source of truth.
- Give the React wizard/profile screens loading, success, validation-error and server-error states.

**Non-Goals:**

- Recommendation ranking, hard filtering of dishes or Places integration.
- Admin catalog management or catalog imports.
- Rebuilding the visual mockup or adding a new authentication UI in this change.
- Inferring allergies or preferences from natural language or past orders.

## Decisions

### 1. Use a dedicated taste-profile backend module

Add a module under `backend/src/modules/taste-profile/` with route, schema, service and repository boundaries. Routes handle authentication and HTTP schemas, the service owns validation/orchestration, and the repository owns Prisma queries. This follows the existing auth module shape and keeps recommendation code from reaching directly into Prisma.

Alternative considered: put profile handlers into `users.route.ts`. Rejected because the profile has multiple related aggregates and will become a dependency of recommendation, onboarding and profile UI flows.

### 2. Use one normalized response contract

All profile endpoints return the same envelope:

```json
{
  "data": {
    "profile": {
      "spicyLevel": 35,
      "sweetLevel": 45,
      "sourLevel": 30,
      "saltyLevel": 40,
      "budgetMin": 30000,
      "budgetMax": 70000,
      "maxDistanceMeters": 3500,
      "onboardingCompleted": true,
      "allergies": [{ "code": "SEAFOOD", "name": "Hải sản", "severity": "SEVERE", "notes": null }],
      "dietaryRestrictions": [{ "code": "NO_SCALLION", "name": "Không hành lá", "isMandatory": true }],
      "cuisinePreferences": [{ "code": "VIETNAMESE", "name": "Ẩm thực Việt", "preferenceScore": 100 }]
    }
  }
}
```

`GET` with no profile returns `profile: null`; mutation endpoints return the saved profile. This prevents the frontend from having separate DTO handling for onboarding and profile screens.

Alternative considered: return raw Prisma relations. Rejected because database field names, IDs and relation shape would leak into UI and make future API evolution harder.

### 3. Validate catalog codes before opening the write transaction

The service resolves all submitted codes and rejects unknown or duplicate selections before writes. A successful replacement then runs in one Prisma transaction: upsert the scalar profile, replace user selection rows, and return the fully reloaded normalized profile. This guarantees a failed request cannot leave a half-updated profile.

### 4. Treat `PUT /users/me/profile` as full replacement

The payload represents the complete desired profile, including empty arrays for cleared selections. Full replacement is easier to reason about for the wizard and makes retries idempotent. A future patch endpoint can be added only if a product flow needs partial edits.

Alternative considered: separate endpoints for every allergy, cuisine and preference row. Rejected for onboarding because it creates partial-save states and too many client round trips.

### 5. Keep frontend API code separate from presentational screens

Add a small frontend API client and profile mapper. `TastePage` and `ProfilePage` should consume a view model and submit actions; they should not know Prisma field names, URL paths or response envelopes. Until the auth UI exists, the client will use the existing session/token boundary and retain a clearly isolated development mock fallback rather than mixing mock values into components.

## Risks / Trade-offs

- [Existing frontend has no complete auth/session flow] → Keep API client token injection explicit and gate live integration behind the existing authenticated session; retain mock mode only as a development adapter.
- [Catalog seed codes change] → Treat catalog codes as stable public identifiers, cover them with seed tests, and reject unknown codes instead of silently dropping selections.
- [Concurrent profile updates] → Use a transaction and return the latest committed profile; the UI should refresh after mutation rather than merge local state blindly.
- [Large profile payloads grow over time] → Use bounded arrays and TypeBox maximums for fields/notes, and avoid returning unrelated user/order data.
- [Allergy meaning is safety-sensitive] → Keep allergies as hard constraints in the response and never downgrade them based on severity or UI selection.

## Migration Plan

1. Add backend schemas, repository, service, routes and tests; register the module in `app.ts`.
2. Run existing migrations/seed and verify catalog codes are available; no new migration is expected.
3. Add frontend API client and connect the wizard/profile actions behind the authenticated session.
4. Deploy backend first, then enable the frontend live adapter.
5. Roll back by disabling the live adapter and reverting route registration; existing database tables remain compatible.
