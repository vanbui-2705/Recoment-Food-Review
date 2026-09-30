## Purpose

Provide stable, read-only normalized catalogs that the onboarding client can use to render safe choices and submit codes accepted by the taste profile API.

## ADDED Requirements

### Requirement: Read-only normalized catalog endpoints
The system SHALL expose authenticated read-only endpoints for allergens, dietary restrictions and cuisines.

#### Scenario: List allergen catalog
- **WHEN** an authenticated client requests `GET /catalogs/allergens`
- **THEN** the system returns each available allergen with a stable code, display name and optional description

#### Scenario: List dietary restriction catalog
- **WHEN** an authenticated client requests `GET /catalogs/dietary-restrictions`
- **THEN** the system returns each available dietary restriction with a stable code, display name and optional description

#### Scenario: List cuisine catalog
- **WHEN** an authenticated client requests `GET /catalogs/cuisines`
- **THEN** the system returns each available cuisine with a stable code, display name and optional description

### Requirement: Catalog responses are deterministic and cannot be mutated by clients
Catalog endpoints SHALL return a stable response envelope and deterministic ordering, and SHALL not accept create, update or delete operations from the onboarding client.

#### Scenario: Repeat a catalog request
- **WHEN** the same user requests the same catalog twice without catalog data changing
- **THEN** the response shape and item ordering remain the same

#### Scenario: Attempt catalog mutation
- **WHEN** a client attempts to mutate a catalog through the onboarding API
- **THEN** the system rejects the request and leaves catalog data unchanged

### Requirement: Invalid catalog access is protected
The system SHALL require valid authentication for catalog reads and SHALL return a structured error for invalid requests.

#### Scenario: Unauthenticated catalog request
- **WHEN** an unauthenticated client requests any catalog endpoint
- **THEN** the system returns `401` without catalog data

