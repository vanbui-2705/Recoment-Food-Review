## Purpose

Provide a complete session and authorization boundary so registered users can authenticate, access protected resources, refresh sessions safely, log out, and be restricted by role.

## ADDED Requirements

### Requirement: User login

The system SHALL authenticate an active user with a normalized email and password, and SHALL return a uniform unauthorized error when the account does not exist, is disabled, or the password is incorrect.

#### Scenario: Successful login
- **WHEN** an active user submits valid credentials
- **THEN** the system returns the public user, a short-lived access token, an opaque refresh token, and the access-token lifetime

#### Scenario: Invalid login credentials
- **WHEN** a user submits an unknown email or an incorrect password
- **THEN** the system returns HTTP 401 with the same authentication error shape and does not reveal which credential failed

#### Scenario: Disabled user login
- **WHEN** a disabled user submits otherwise valid credentials
- **THEN** the system returns HTTP 401 and does not issue either token

### Requirement: Access-token authentication

Protected endpoints SHALL require a valid, unexpired access token whose subject identifies an active user. The system MUST NOT accept refresh tokens as access tokens.

#### Scenario: Protected request with valid access token
- **WHEN** a request includes a valid access token for an active user
- **THEN** the endpoint receives that user identity and may return the requested resource

#### Scenario: Missing, malformed, expired, or wrong-type token
- **WHEN** a protected request lacks a valid access token
- **THEN** the system returns HTTP 401 without exposing token verification details

### Requirement: Current-user endpoint

The system SHALL provide `GET /users/me` for an authenticated user and SHALL return only that user's public profile.

#### Scenario: Read own profile
- **WHEN** an authenticated user requests `/users/me`
- **THEN** the response contains that user's public identity and role, and never contains password or token hashes

### Requirement: Refresh-token rotation

The system SHALL issue refresh tokens as opaque random values, store only their hashes, and rotate a valid refresh token exactly once when refreshing a session.

#### Scenario: Successful refresh
- **WHEN** an active user submits a valid, unexpired, non-revoked refresh token
- **THEN** the system revokes the submitted token, records its replacement, and returns a new access-token/refresh-token pair

#### Scenario: Reused, revoked, or expired refresh token
- **WHEN** a refresh request submits a reused, revoked, expired, or unknown refresh token
- **THEN** the system returns HTTP 401 and does not issue tokens

#### Scenario: Disabled user refresh
- **WHEN** a refresh token belongs to a disabled user
- **THEN** the system returns HTTP 401 and does not issue tokens

### Requirement: Logout

The system SHALL revoke the submitted refresh token and SHALL make logout idempotent.

#### Scenario: Logout active session
- **WHEN** a client submits a refresh token that is currently valid
- **THEN** the system revokes that token and returns a successful empty response

#### Scenario: Logout unknown or already revoked session
- **WHEN** a client submits an unknown or already revoked refresh token
- **THEN** the system returns the same successful empty response without revealing token state

### Requirement: Authenticated password change

The system SHALL allow an authenticated active user to change their password only after verifying the current password, SHALL hash the new password with a password-hashing algorithm, and SHALL revoke all refresh sessions for that user after a successful change.

#### Scenario: Successful password change
- **WHEN** an authenticated user submits the correct current password and a different valid new password
- **THEN** the system updates the password, revokes the user's refresh sessions, and returns a successful empty response

#### Scenario: Incorrect current password
- **WHEN** an authenticated user submits an incorrect current password
- **THEN** the system returns HTTP 401 and does not change the password or revoke sessions

#### Scenario: Reusing the current password
- **WHEN** an authenticated user submits the current password as the new password
- **THEN** the system returns HTTP 400 and does not change the password

### Requirement: Authentication rate limiting

The system SHALL rate-limit registration, login, refresh, and password-change attempts by client IP within a bounded time window, and SHALL return HTTP 429 with a retry hint after the limit is exceeded.

#### Scenario: Credential endpoint within limit
- **WHEN** a client makes no more than the configured number of requests in the current window
- **THEN** the request proceeds to normal validation and authentication handling

#### Scenario: Credential endpoint exceeds limit
- **WHEN** a client exceeds the configured request limit within the current window
- **THEN** the system returns HTTP 429, includes `Retry-After`, and does not execute the authentication operation

### Requirement: Role-based authorization

Protected administrative endpoints SHALL require the `ADMIN` role from the current database record, and ordinary users SHALL be denied with HTTP 403.

#### Scenario: Admin access
- **WHEN** an authenticated active admin calls an admin-protected endpoint
- **THEN** the request is authorized

#### Scenario: Non-admin access
- **WHEN** an authenticated active non-admin calls an admin-protected endpoint
- **THEN** the system returns HTTP 403

### Requirement: Authentication configuration and secret handling

JWT signing secrets and token lifetimes SHALL come from validated environment configuration. Passwords and raw refresh tokens MUST NOT be logged, returned in public user objects, or stored in the database.

#### Scenario: Production configuration without a signing secret
- **WHEN** the application starts in production without a sufficiently strong JWT secret
- **THEN** configuration loading fails before the server starts

#### Scenario: Authentication response serialization
- **WHEN** any authentication endpoint returns a user
- **THEN** the response excludes password hashes and refresh-token hashes
