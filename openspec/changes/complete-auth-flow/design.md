## Context

The current backend uses Fastify, Prisma PostgreSQL, Argon2id password hashing, and a `refresh_tokens` table, but only registration is implemented. The design extends the existing repository/service split and keeps the current camelCase API convention.

## Goals / Non-Goals

**Goals:**

- Complete the access-token and refresh-token lifecycle using the existing schema.
- Make authentication available as reusable Fastify decorators and keep authorization based on the current database role/status.
- Make refresh rotation safe under concurrent requests and keep secrets out of responses/logs.
- Make all new behavior testable without requiring external identity or mail providers.
- Allow users to change their password securely and throttle credential endpoints against basic brute-force abuse.

**Non-Goals:**

- Social login, multi-factor authentication, password reset, and email delivery/verification.
- Distributed rate limiting; this requires shared infrastructure beyond the current service.
- Changing existing catalog/recommendation data models.

## Decisions

- Use a short-lived HMAC JWT access token containing only user id, role, token type, issuer, and timestamps. Use an opaque 32-byte random refresh token so the database stores only a SHA-256 digest. This avoids putting refresh-session state into a self-contained token.
- Keep refresh tokens in the request body to match the existing documented API contract. HttpOnly cookie transport can be added later without changing database behavior.
- Add an authentication Fastify plugin exposing `authenticate` and role authorization decorators. Each authenticated request loads the current user status/role from the database, so disabling a user or changing a role takes effect immediately.
- Rotate refresh tokens in a transaction: create the replacement, then conditionally revoke the old row with `revokedAt IS NULL`. A concurrent second request fails the conditional update and receives 401.
- Return generic 401 errors for login and refresh failures. Return 403 only after a valid identity has been established but its role is insufficient.
- Require `JWT_ACCESS_SECRET` in production and provide a clearly development-only fallback for local/test execution. Token TTLs remain environment-configurable with safe defaults.
- Verify the current password with Argon2id before changing it, hash the replacement, and revoke all refresh sessions in one database transaction so a password change requires fresh login on every device.
- Use a reusable in-memory Fastify pre-handler keyed by client IP for register, login, refresh, and change-password. Limits are intentionally conservative and return `Retry-After`; a shared Redis-backed limiter remains a deployment follow-up for multi-instance environments.

## Risks / Trade-offs

- [Risk] A body-carried refresh token can be exposed by an unsafe client or proxy → [Mitigation] never log it, store only its hash, document HTTPS requirements, and leave cookie transport as a future hardening option.
- [Risk] Per-request user lookup adds database traffic → [Mitigation] keep the query narrow and prioritize immediate disabled-user/role revocation for this MVP.
- [Risk] In-memory rate limiting is not safe across replicas → [Mitigation] leave distributed rate limiting out until Redis or an equivalent shared store is available.

## Migration Plan

No schema migration is required for the core flow because `users` and `refresh_tokens` already contain the required fields. Deploy the code after applying existing migrations, set `JWT_ACCESS_SECRET` and TTL variables, then run the auth integration/database tests.

## Open Questions

None.
