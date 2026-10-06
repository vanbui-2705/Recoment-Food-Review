## Context

See proposal.md for scope. Fastify/Prisma/PostgreSQL and React/Vite already implement discovery, recipes, photo proxy, profile descriptions and CHOSEN/EATEN cooldown. `PersonalFoodKnowledge` uses revision/analyzedRevision; automatic personalization is gated until analysis. `RestaurantDish` has one dish per restaurant and cannot represent multiple sizes; recommendation history models exist but the current today endpoint does not persist full requests. Existing main specs protect uniqueness, rating semantics and history lifecycle.

The executable work breakdown is tasks.md; module APIs, UI, config and acceptance detail are in [the completion plan](../../../docs/REC_FOOD_COMPLETION_PLAN.md). That plan is part of this change, and defines P0–P6 and the mapping to inventory groups 1–12.

## Goals / Non-Goals

**Goals:** extend the current modules incrementally; preserve owner authorization, source attribution and 96-hour exclusion; distinguish strict verified recommendations from discovery with unknown prices; deliver testable provider interfaces and clear live-readiness gates.

**Non-Goals:** cart/order/payment/delivery implementation, transaction tools, fabricated merchant evidence, replacement of free-text onboarding with required catalog forms. These transaction features remain Coming soon.

## Decisions

### 1. One discovery platform, incremental modules

Keep the modular monolith. Add `ai`, `taste-analysis`, `merchant-menu`, `restaurant-details`, `recommendations`, `chat`, `feedback`, `admin-content`, `account` and `jobs` boundaries; preserve existing public endpoints during migration. Shared normalized DTOs prevent venue ratings/photos from being relabelled dish-specific. Microservices add operational cost before there is scale evidence and are deferred.

### 2. Durable jobs using PostgreSQL

Use lease-based jobs and transactional outbox, claimed by a separate worker with unique identity and bounded retry. Claims use row locking/skip-locked or equivalent atomic conditional update, not read-then-write. Analysis uniqueness is user + source revision + schema version. Lease duration covers provider deadlines; renewal and worker recovery are tested. PostgreSQL avoids adding Redis purely to schedule low-volume jobs; benchmark before adding a queue service.

### 3. Revision-aware knowledge extraction

Saved description enqueues analysis. Model output has a strict catalog-backed schema, source excerpts and unknown/ambiguous states. Soft preferences apply only after validation and revision compare-and-swap. Safety changes require targeted user review; existing allergies cannot be removed by omission. Profile update and analyzedRevision commit atomically only when all blocking questions are resolved. Polling job status is sufficient for this small workflow; chat uses streaming separately.

### 4. Merchant offers separate from catalog concepts

`ExternalRestaurantIdentity` maps provider IDs to restaurants; `ExternalMenuItem` identifies an actual supplier offer with price/currency/options/expiry and optional canonical dish. Keep existing RestaurantDish constraints; project compatible single offers where appropriate and reference offer identity in new results. Unknown identities enter review rather than guessed merges. Dry-run, quarantine, full-sync completeness and safe removal rules prevent bulk corruption on partial upstream failure. A supplier-specific adapter depends on actual authorized API documentation, not a generic imaginary public endpoint.

### 5. Safety evidence has its own lifecycle

Store restaurant/offer-specific allergen, diet and cross-contact evidence with provenance, verification and expiry. Ingredient knowledge is a search aid, not proof of a merchant's preparation. Safety filters run in backend before ranking and tools. Unknown/expired/conflicting evidence blocks automatic safety claims; explicit search can still show the venue with uncertainty. Admin review cannot turn missing evidence into an ABSENT claim without a source.

### 6. Deterministic candidates first, bounded AI second

One candidate pipeline loads profile revision, fresh offers/place metadata and identity-aware recent history; applies safety/budget/radius/opening/availability/cooldown; normalizes scores to 0–100; then diversifies. Configurable bounded weights and deterministic ties produce a baseline. Reranking takes at most 20 candidates, checks unique allowed IDs and grounded reasons, and falls back on timeout/invalid output. Persist permitted snapshots, not raw private reasoning or Google content without storage rights. A model-specific adapter will be selected and documented at implementation; the provider-neutral contract is fixed here.

### 7. Authenticated chat runs with limited tools

Conversations/messages/runs are owner-scoped. Use fetch-based SSE with bearer headers, event sequence and reconnect cursor; never put access tokens into URLs. A run has one active execution, idempotent submit, total deadline and at most five tool calls. Tool dispatcher injects user identity and validates arguments/results; only discovery/profile tools exist. Transaction requests get Coming soon. Native EventSource is not chosen because the existing bearer auth flow requires headers.

### 8. User control and admin accountability

Feedback attaches to an owned result/offer and follows current rating/idempotency constraints. History deletion previews its effect on cooldown; preferences and safety constraints are separate. Admin writes produce transactional redacted audit records; deactivation preserves referenced history and the last active ADMIN cannot be disabled. Account reset/verify tokens are hashed, expiring and single-use; export/delete require recent authentication. Outbox delivery handles email retries without pretending a failed email succeeded.

### 9. Release gates and retention

CI adds frontend build/browser/Docker alongside backend checks and migration-from-empty. Provider fakes remain CI-only; live integrations have separate permission/credential smoke gates. Readiness depends on DB; metrics redact taste text, tokens and precise location. Cluster-wide API limits use atomic PostgreSQL counters initially; process-local limits do not establish distributed quotas.

Initial retention defaults: chat/recommendation snapshots 90 days, user actions 180 days, temporary exports 24 hours, operational audit 365 days with identity anonymization on account deletion. Privacy UI discloses these before release. Backup goals start at RPO <=24h/RTO <=4h and are verified by an isolated restore drill. Cloud deployment/secrets wiring are selected for the actual target environment; building deployable artifacts is independent from external account access.

## Risks / Trade-offs

- [No supplier contract/key] → build and test ingestion infrastructure; keep menu live-readiness open and show unpriced venues honestly.
- [Safety data unavailable] → block automatic safe claims; preserve explicit discovery and obtain evidence from authorized sources.
- [AI output ambiguous or stale] → targeted review, revision CAS, schema/candidate validation and deterministic fallback.
- [Provider content storage restrictions] → source-specific retention/attribution policy before storing snapshots; no generic photo cache.
- [PostgreSQL job/quota contention] → bounded batches, indexes and load tests; introduce queue/cache only with measured need.
- [History deletion changes cooldown] → explicit preview/confirmation; report the changed behavior rather than silently retaining undeleted copies.
- [New model/API dependency changes] → verify official contracts during adapter implementation and pin the integration version.

## Migration Plan

1. Baseline existing tests and schema. Add each module in a separate additive migration, preserving current profile, restaurant-dish and history invariants.
2. Backfill stable external identities only from existing known provider IDs; do not backfill demo menus as live evidence or mark descriptions analyzed.
3. Deploy schema/config first, then web/worker with flags off; run ownership, lease recovery and rollback compatibility tests.
4. Enable P1 analysis, then P2 provider-specific ingest/details, then P3 recommendation endpoints and frontend migration. Existing today/interaction routes remain compatible until consumers migrate.
5. Enable chat/feedback/admin/account in reviewed slices. Run staging/live smoke with real credentials separately from CI fakes.
6. Rehearse backup restore and application rollback, verify release gates and Coming soon, then deploy the scoped release.
7. Roll back application to the previous compatible image and pause affected workers; do not drop additive tables or delete knowledge/evidence. Destructive contract migrations require a later reviewed change after all consumers have moved.
