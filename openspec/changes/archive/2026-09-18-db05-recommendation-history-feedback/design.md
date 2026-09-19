## Context

DB01–DB04 provide users, preferences, safe dish metadata, restaurants, and menu availability. DB05 persists the decision boundary and observed outcomes so later ranking services can be audited and improved without storing private model internals.

## Goals / Non-Goals

**Goals:**

- Preserve the user/context snapshot that produced a recommendation.
- Store stable ordered results and explainable user-facing metadata.
- Make feedback ingestion idempotent and ratings unambiguous.
- Provide efficient per-user chronological history.

**Non-Goals:**

- Implementing recommendation algorithms, analytics pipelines, collaborative filtering, or HTTP endpoints.
- Storing raw prompts/responses, chain-of-thought, credentials, or mutable copies of the full user profile.
- Automatically changing allergy constraints from feedback.

## Decisions

### Separate request, result, and interaction events

`RecommendationRequest` captures input context and outcome status. `RecommendationResult` captures ordered candidates. `UserInteraction` captures later behavior and can optionally reference a result. Separating these lifecycles avoids rewriting historical requests as users interact.

### Store bounded decimal scores and JSON safety warnings

Scores use fixed precision and database checks for 0–100. Safety warnings use JSONB so warnings remain structured without prematurely fixing a nested schema. A user-facing reason is plain text; no private reasoning column exists.

### Use global idempotency keys for feedback

`UserInteraction.idempotencyKey` is globally unique so retries from clients or queues cannot double-count feedback. Scoping only by user was rejected because event producers should issue globally stable identifiers and global uniqueness is simpler to enforce.

### Preserve catalog records referenced by history

User-owned history cascades when the user is deleted, and request-owned results cascade with the request. Dish and restaurant foreign keys use `RESTRICT` so catalog deletion cannot silently corrupt retained history. An optional result link uses `SET NULL`, allowing an interaction event to remain attributable to its dish if a result is explicitly removed.

### Encode rating semantics in PostgreSQL

A named check constraint requires `RATED` to carry a 1–5 rating and all other interaction types to carry no rating. Application-only validation was rejected because feedback may arrive through future workers or imports.

## Risks / Trade-offs

- [JSON safety warnings are weakly typed in the database] → Validate their structure at service boundaries and keep the top-level column limited to warnings.
- [Restricting catalog deletion complicates cleanup] → Prefer status/availability changes; explicitly remove history only through governed retention workflows.
- [Snapshot fields can diverge from current user preferences] → Treat request rows as immutable historical context by design.
- [Global idempotency depends on producers generating stable keys] → Document the contract and retain a unique database constraint as the final safeguard.

## Migration Plan

1. Add DB05 enums and the three history tables with indexes and constraints.
2. Regenerate Prisma Client and deploy the migration to the existing database.
3. Verify request/result/interaction behavior and lifecycle with integration tests.
4. Replay all migrations against a clean database and run the full backend quality suite.
