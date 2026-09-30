## 1. Contract and module setup

- [x] 1.1 Create the `backend/src/modules/taste-profile/` module boundaries for routes, TypeBox schemas, service logic, repository access, and shared DTOs.
- [x] 1.2 Define strict request and response schemas for profile, onboarding, catalog items, and validation errors, including bounded numeric fields and `additionalProperties: false`.
- [x] 1.3 Register the taste-profile and catalog routes in the Fastify app behind the existing `app.authenticate` hook.

## 2. Food constraint catalog API

- [x] 2.1 Implement repository/service reads for allergens, dietary restrictions, and cuisines with deterministic ordering by stable code.
- [x] 2.2 Implement authenticated `GET /catalogs/allergens`, `GET /catalogs/dietary-restrictions`, and `GET /catalogs/cuisines` responses using the agreed stable envelope.
- [x] 2.3 Add route tests covering the response shape, deterministic ordering, unauthenticated access, and the read-only contract.

## 3. Taste profile API and persistence

- [x] 3.1 Implement the normalized profile reader, including `profile: null` for users without a profile and normalized allergy, dietary, and cuisine collections.
- [x] 3.2 Implement catalog-code resolution and validation before writes, rejecting unknown and duplicate selections without changing persisted data.
- [x] 3.3 Implement transactional full replacement for `PUT /users/me/profile`, including profile upsert and replacement of relation rows scoped to the authenticated user.
- [x] 3.4 Implement transactional `POST /users/me/onboarding`, marking onboarding complete only after all profile and constraint validation succeeds.
- [x] 3.5 Add API tests for successful read/replace/onboarding, 401 responses, invalid numeric ranges, unknown codes, duplicate codes, idempotent replacement, atomic rollback, and cross-user isolation.
- [x] 3.6 Verify the implementation against the existing Prisma schema and run the relevant Prisma generate, migration, seed, and database test checks without introducing unnecessary tables.

## 4. Frontend integration

- [x] 4.1 Add a frontend API client with explicit auth-token injection and DTOs for profile and catalog responses.
- [x] 4.2 Add a mapper from API DTOs to the existing `TastePage` and `ProfilePage` view models, keeping any development mock fallback isolated behind the adapter boundary.
- [x] 4.3 Connect `TastePage` to catalog loading and profile/onboarding save flows with loading, field-validation, server-error, and success states.
- [x] 4.4 Connect `ProfilePage` to the live profile read/update flow while preserving the hard-constraint presentation for allergies and mandatory dietary restrictions.
- [x] 4.5 Add adapter/component smoke coverage for the API mapping and the main loading, success, and error states.

## 5. Verification and handoff

- [x] 5.1 Run backend typecheck, lint, unit/API tests, and the frontend production build.
- [x] 5.2 Run an authenticated end-to-end smoke flow: load catalogs, submit onboarding, reload the profile, edit it, and verify persisted values after refresh.
- [x] 5.3 Document endpoint examples, frontend integration assumptions, and the mock-to-real data replacement boundary for the next implementation pass.
