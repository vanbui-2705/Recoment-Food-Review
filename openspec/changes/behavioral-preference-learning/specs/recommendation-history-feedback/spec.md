## MODIFIED Requirements

### Requirement: Idempotent user interactions
The system SHALL accept `VIEWED`, `LIKED`, `SKIPPED`, `CHOSEN`, `EATEN`, and `RATED` dish interactions for the authenticated user with a globally unique idempotency key, SHALL validate rating and eaten-time semantics, and MAY link the interaction to a recommendation result and restaurant.

#### Scenario: Feedback is retried
- **WHEN** the same user retries the same interaction with the same idempotency key and payload
- **THEN** the original interaction is returned and the signal is counted once

#### Scenario: Idempotency key is reused for different feedback
- **WHEN** the same idempotency key is submitted with a different dish, type, rating, or eaten time
- **THEN** the system rejects the conflicting request

#### Scenario: Interaction history is queried
- **WHEN** interactions are queried for a user in descending creation time
- **THEN** their typed dish and recommendation context is available newest first

#### Scenario: Catalog behavior is recorded without a recommendation result
- **WHEN** the user views, likes, skips, chooses, eats, or rates a catalog dish outside a persisted recommendation request
- **THEN** the typed interaction is stored against that user and dish without requiring a recommendation-result link

