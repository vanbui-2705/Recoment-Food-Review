## Purpose

Expose a validated, authenticated taste profile contract so the web client and future recommendation engine can use the same user preferences and hard dietary constraints.

## ADDED Requirements

### Requirement: Authenticated profile retrieval
The system SHALL expose `GET /users/me/profile` and SHALL return the authenticated user's taste profile, allergies, dietary restrictions and cuisine preferences only.

#### Scenario: User has a completed profile
- **WHEN** an authenticated user requests `GET /users/me/profile`
- **THEN** the response is `200` with the user's profile and normalized constraint selections

#### Scenario: User has no profile
- **WHEN** an authenticated user requests `GET /users/me/profile` before completing onboarding
- **THEN** the response is `200` with `profile: null` and empty constraint/preference collections

#### Scenario: Request has no valid authentication
- **WHEN** an unauthenticated request calls `GET /users/me/profile`
- **THEN** the system returns `401` and does not expose profile data

### Requirement: Profile replacement is scoped to the authenticated user
The system SHALL expose `PUT /users/me/profile` as an idempotent replacement operation and SHALL derive the target user from the authenticated session rather than from a client-supplied user ID.

#### Scenario: Create a first profile
- **WHEN** an authenticated user submits a valid profile payload
- **THEN** the system creates one profile for that user and returns the normalized saved profile

#### Scenario: Replace an existing profile
- **WHEN** an authenticated user submits a valid profile payload for an existing profile
- **THEN** the system replaces the profile scalar values and replaces the submitted catalog selections without affecting another user

#### Scenario: Repeat the same replacement
- **WHEN** the same valid payload is submitted twice
- **THEN** the second request succeeds and does not create duplicate profile or selection records

### Requirement: Onboarding completion is explicit and validated
The system SHALL expose `POST /users/me/onboarding` and SHALL set `onboardingCompleted` to true only after the complete payload and all referenced catalog codes pass validation.

#### Scenario: Complete onboarding successfully
- **WHEN** an authenticated user submits valid location, taste, budget, distance, allergy, dietary and cuisine data
- **THEN** the system persists the data, marks onboarding complete and returns the same normalized profile contract used by `GET /users/me/profile`

#### Scenario: Incomplete onboarding payload
- **WHEN** required onboarding fields are missing
- **THEN** the system returns `400`, does not mark onboarding complete and does not partially persist the request

### Requirement: Profile validation protects hard constraints
The system MUST reject flavor scores outside `0..100`, negative budgets, reversed budget ranges, non-positive maximum distances and unknown catalog codes.

#### Scenario: Invalid numeric value
- **WHEN** a profile payload contains an out-of-range flavor score, invalid budget range or non-positive distance
- **THEN** the system returns `400` with field-level validation errors and leaves the previous profile unchanged

#### Scenario: Unknown or duplicate selection
- **WHEN** a profile payload references an unknown allergen, dietary restriction or cuisine code, or repeats a selection
- **THEN** the system returns `400` and does not persist any part of the invalid update

### Requirement: Hard constraints remain distinguishable from soft preferences
The profile response SHALL represent allergies as hard constraints and SHALL preserve `isMandatory` for dietary restrictions and `preferenceScore` for cuisine preferences.

#### Scenario: Read profile constraints
- **WHEN** a profile contains allergies, dietary restrictions and cuisine preferences
- **THEN** the response clearly separates the allergy list, mandatory dietary restrictions and scored cuisine preferences

