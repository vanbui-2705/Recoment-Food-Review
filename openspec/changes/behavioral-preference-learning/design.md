## Context

The catalog dashboard uses `food.service.today`, while the offer-backed recommendation pipeline already has idempotent feedback and a narrow exact-dish adjustment. Existing tables support all required interaction types, dish flavor levels, cuisines, prices, and timestamps, so the learning loop can be added without a schema migration or a new external model.

## Goals / Non-Goals

**Goals:**

- Make catalog ordering respond to behavior on related dishes, not only the exact liked dish.
- Keep the learned component inspectable, deterministic, bounded, recency-aware, and private per user.
- Capture useful UI signals without equating a render or click with strong positive intent.
- Show the user what EatWise learned and why a card moved.

**Non-Goals:**

- Training a global collaborative-filtering model across users.
- Sending interaction history to a third-party LLM.
- Weakening allergy, diet, budget, meal period, activity, or cooldown eligibility.
- Inferring sensitive health attributes from behavior.

## Decisions

### Compute an affinity snapshot on request

Build a pure policy from the last 180 days of user-scoped interactions plus current explicit preferences. Each signal has a signed strength and exponential recency decay; repeated same-type signals for one dish are capped. This avoids a migration and keeps deletion/export behavior aligned with existing interaction records. A materialized profile can be introduced later if catalog scale makes request-time computation too costly.

### Generalize through explainable dish features

Similarity combines cuisine equality, four normalized flavor dimensions, and price-band proximity. Direct dish feedback has the largest contribution. These catalog facts are already curated and allow concrete explanations; opaque embeddings were rejected because the small catalog does not justify their privacy and operational cost.

### Bound behavioral influence

Convert affinity to at most ±24 ranking points. A view carries only a very small positive signal; like, eaten, and high rating are strongest; skip, dislike, and low rating are negative. Hard eligibility runs first. Stable tie-breaking and existing catalog diversity remain intact.

### Use one interaction endpoint for the catalog loop

Extend the existing dish interaction endpoint to all enum types and semantic validation. Explicit like state remains in `UserDishPreference`, while a `LIKED` event adds time-aware evidence. The client sends separate idempotency keys and disables duplicate UI actions while a request is pending.

### Render learning state in the existing discovery hierarchy

The hero reason panel gains a compact learning summary. Cards gain an accessible not-for-me action; the hero records a view only after a visible dwell. Saved feedback removes skipped cards and refreshes ordering, with loading, success, and failure feedback in the existing orange/neutral visual system.

## Risks / Trade-offs

- [Small catalogs can overfit quickly] → cap per-dish/type evidence, bound total adjustment, and retain a cold-start/exploration path.
- [Views can be accidental] → record only after dwell and assign the weakest weight.
- [Repeated browser sessions can create many view rows] → deterministic session idempotency keys and backend aggregation caps prevent score inflation.
- [Request-time history scan grows] → limit to 180 days and 500 recent events; add a materialized snapshot only when measured scale requires it.
- [Explanations can overclaim causality] → expose only catalog-feature matches and sample/confidence levels, never private reasoning or safety claims.

## Migration Plan

1. Deploy backend interaction validation and affinity policy; no database migration is required.
2. Deploy response additions as backward-compatible optional fields.
3. Deploy discovery feedback controls and dwell tracking.
4. Verify two-user isolation, ranking movement, and responsive rendering against the real Docker stack.
5. Rollback by removing the behavioral adjustment and UI controls; existing interaction rows remain valid history data.
