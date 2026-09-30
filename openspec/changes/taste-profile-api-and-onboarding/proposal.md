## Why

The current database already stores taste profiles, allergies, dietary restrictions and cuisine preferences, but the application has no authenticated API to read or update them. The React onboarding/profile screens therefore still use mock state, so recommendation work cannot safely consume a real user profile. This is the first product module because allergies, dietary constraints, budget, distance and preferences are required inputs for every later recommendation flow.

## What Changes

- Add authenticated endpoints to read and replace the current user's taste profile.
- Add an onboarding endpoint that saves the profile and marks onboarding complete only after the full payload passes validation.
- Add read-only catalog endpoints for allergens, dietary restrictions and cuisines.
- Add validation for flavor scores, budget range, maximum distance, catalog identifiers and duplicate selections.
- Return a stable, frontend-friendly profile response including hard constraints and soft preferences.
- Connect the React taste wizard/profile screens to the API behind a small frontend API client.
- Add unit, route and database tests for valid input, invalid input, ownership and idempotent updates.

## Capabilities

### New Capabilities

- `taste-profile-api`: Authenticated read/update/onboarding API for a user's structured taste profile and constraints.
- `food-constraint-catalog-api`: Read-only normalized catalog API for allergens, dietary restrictions and cuisines.

### Modified Capabilities

- None. Existing database constraints remain the source of truth; this change exposes them through an API.

## Impact

- Backend: new taste-profile module, route schemas, service/repository code, app registration and tests.
- Frontend: API client, typed DTO mapping, loading/error/success states and replacement of mock wizard/profile state.
- Database: no new tables expected; existing Prisma models and constraints will be reused.
- Authentication: all profile mutations and reads require the existing `app.authenticate` hook.
- Future recommendation engine: consumes the stable profile response and hard-constraint fields without depending on UI state.
