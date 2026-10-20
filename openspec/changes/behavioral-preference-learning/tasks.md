## 1. Behavioral ranking policy

- [x] 1.1 Add unit tests for signal weights, recency decay, similarity propagation, bounded adjustments, confidence, and cold start.
- [x] 1.2 Implement a pure per-user affinity policy over cuisine, flavor, price band, direct dish, and explicit preference signals.
- [x] 1.3 Integrate affinity into catalog recommendation ordering after hard eligibility and return grounded learning summaries/reasons.

## 2. Interaction capture and isolation

- [x] 2.1 Extend the catalog interaction API to validate and idempotently store VIEWED, LIKED, SKIPPED, CHOSEN, EATEN, and RATED.
- [x] 2.2 Add database tests proving ranking movement, hard-constraint precedence, idempotency, and isolation between two users.
- [x] 2.3 Ensure behavioral interaction data remains covered by account export and deletion behavior.

## 3. Discovery feedback UX

- [x] 3.1 Extend frontend adapters/API contracts for learning summaries and behavioral feedback.
- [x] 3.2 Render the learning state, learned reasons, like/not-for-me actions, pending/error states, and delayed hero view capture in the existing responsive discovery UI.
- [x] 3.3 Add Playwright tests proving visible feedback controls, one dwell event, skip removal, and refreshed ordering on desktop and mobile.

## 4. Real-stack verification

- [x] 4.1 Run backend typecheck/unit/database tests and frontend build/Playwright regression suites.
- [x] 4.2 Validate OpenSpec, rebuild Docker, and run authenticated two-user ranking and desktop/mobile render smoke tests through localhost:8081.
- [x] 4.3 Save current runtime screenshots and verify no browser console errors or failed API requests in the completed feedback loop.
