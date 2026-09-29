## Why

The repository currently has an authentication database foundation and a registration endpoint, but users cannot log in, maintain a session, access protected resources, or be restricted by role. The existing `refresh_tokens`, `role`, and `status` fields are otherwise unused, leaving the application unable to provide a complete and testable authentication boundary.

## What Changes

- Add login with Argon2id password verification and a uniform invalid-credentials response.
- Issue short-lived JWT access tokens and opaque refresh tokens; store only refresh-token hashes.
- Add refresh-token rotation, reuse/revocation checks, expiry checks, and logout.
- Add authentication middleware/decorator and `GET /users/me`.
- Add role-based authorization for `USER` and `ADMIN`, including a protected admin example route.
- Reject disabled users during login, refresh, and authenticated requests.
- Add authenticated password change with current-password verification and refresh-session revocation.
- Add per-process rate limits to registration and credential/session endpoints.
- Add environment validation for JWT secret and token lifetimes.
- Add unit, integration, and database-backed tests for the complete flow.
- Email verification is intentionally excluded from this change.

## Capabilities

### New Capabilities

- `complete-auth-flow`: Login, access-token authentication, refresh-token lifecycle, logout, password change, current-user lookup, rate limiting, and role-based authorization.

### Modified Capabilities

- None.

## Impact

- Affected backend auth module, security utilities, Fastify app decorators/hooks, environment configuration, Prisma access layer, and tests.
- New runtime dependencies may include JWT signing/verification support.
- New API endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/change-password`, `GET /users/me`, and an admin-protected endpoint for authorization verification.
- Existing registration behavior remains compatible, except newly registered users will be explicitly handled by the authentication lifecycle.
