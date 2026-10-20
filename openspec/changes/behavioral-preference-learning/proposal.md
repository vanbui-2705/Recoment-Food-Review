## Why

EatWise currently ranks catalog dishes mostly from onboarding sliders and explicit per-dish likes, so it does not learn that a user who repeatedly likes, chooses, eats, rates, or skips one dish may prefer or avoid similar dishes. The product needs a transparent per-user behavior loop that changes future recommendations while preserving safety, budget, cooldown, and diversity rules.

## What Changes

- Capture idempotent `VIEWED`, `LIKED`, `SKIPPED`, `CHOSEN`, `EATEN`, and `RATED` signals for catalog dishes without treating passive exposure as strong preference.
- Derive a private, bounded, recency-weighted affinity profile from each user's own interaction history and explicit dish preferences.
- Apply learned affinity across similar dishes using cuisine, flavor profile, price band, and direct dish signals, while retaining hard eligibility constraints and exploration diversity.
- Return grounded learning explanations and a compact learning summary with recommendation responses.
- Add discovery controls for like, not-for-me, and view/dwell feedback, plus visible “EatWise is learning your taste” feedback so users can understand why ranking changed.
- Prove with database and browser tests that one user's feedback changes only that user's future ordering and that the rendered localhost experience updates after real interactions.

## Capabilities

### New Capabilities

- `behavioral-food-personalization`: Per-user behavioral signal weighting, cross-dish affinity, bounded ranking adjustments, explanations, and learning summaries.

### Modified Capabilities

- `recommendation-history-feedback`: Expand catalog feedback capture to all supported behavioral interaction types and expose idempotent, user-isolated signals to personalization.

## Impact

- Backend food recommendation service, interaction API, ranking policies, account export, and recommendation response contracts.
- Frontend dashboard adapters, discovery interaction controls, learning status UI, and API client.
- Unit, database, and Playwright tests; no new external dependency or shared cross-user model is introduced.
