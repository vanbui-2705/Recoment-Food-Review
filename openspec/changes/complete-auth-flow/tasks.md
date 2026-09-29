## 1. Configuration and token primitives

- [x] 1.1 Add validated JWT secret and access/refresh lifetime configuration.
- [x] 1.2 Add JWT signing/verification and opaque refresh-token generation/hash helpers.
- [x] 1.3 Add public-user and authentication response schemas for login, refresh, logout, and `/users/me`.

## 2. Authentication persistence and services

- [x] 2.1 Extend the auth repository with user lookup, active-user lookup, refresh-token creation, lookup, rotation, and revocation operations.
- [x] 2.2 Implement login with Argon2id verification and token issuance.
- [x] 2.3 Implement refresh-token rotation with expiry, status, revocation, and concurrent-reuse checks.
- [x] 2.4 Implement idempotent logout and keep raw refresh tokens out of persistence and logs.
- [x] 2.5 Implement current-password verification, password hashing, and refresh-session revocation.

## 3. Fastify authentication and authorization

- [x] 3.1 Add reusable authentication and role-authorization decorators with request typing.
- [x] 3.2 Register login, refresh, and logout routes and preserve existing registration behavior.
- [x] 3.3 Add authenticated `GET /users/me` and an admin-protected endpoint to verify role enforcement.
- [x] 3.4 Add authenticated password-change route and rate limits for sensitive auth endpoints.

## 4. Verification

- [x] 4.1 Add unit tests for token helpers and login/refresh/logout service behavior.
- [x] 4.2 Add route tests for successful/failed authentication, token rotation, `/users/me`, and role checks.
- [x] 4.3 Run typecheck, lint, standard tests, and OpenSpec validation.
- [x] 4.4 Add password-change and rate-limit tests.
- [ ] 4.5 Run database-backed auth tests with PostgreSQL available.
