## Why

Rec-Food can now describe users, dishes, and restaurants, but it cannot audit what was recommended or learn from user outcomes. DB05 completes the MVP database plan with durable recommendation context, ranked results, and idempotent feedback.

## What Changes

- Add recommendation requests containing user, time, location, meal context, budget/distance snapshot, natural-language request, and terminal status.
- Add ranked recommendation results linked to dishes and optional restaurants with bounded scores, user-facing reason, and structured safety warnings.
- Add user interactions for views, likes, skips, choices, meals, and ratings with a globally unique idempotency key.
- Enforce unique ranks per request, rating semantics, score/range constraints, and appropriate cascade/restrict behavior.
- Add indexes for user history queries and database integration coverage.
- Explicitly exclude chain-of-thought, secret prompts, and raw model internals from persisted records.

## Capabilities

### New Capabilities

- `recommendation-history-feedback`: Auditable recommendation requests/results and idempotent user interaction history for downstream learning and analytics.

### Modified Capabilities

None.

## Impact

- Extends the Prisma schema and migration history with the final three planned database tables.
- Adds relations to `User`, `Dish`, and `Restaurant`.
- Adds database tests; no recommendation engine or HTTP endpoint is implemented in this milestone.
