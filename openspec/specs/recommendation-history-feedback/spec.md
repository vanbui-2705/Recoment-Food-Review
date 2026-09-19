# recommendation-history-feedback Specification

## Purpose

Persist auditable recommendation context, ranked outcomes, and idempotent user feedback without retaining private model reasoning or secret prompt data.

## Requirements

### Requirement: Recommendation request history
The system SHALL record each recommendation request with its user, request time, valid location, optional meal/weather/request text, optional valid budget and distance snapshot, and a terminal status.

#### Scenario: User history is queried
- **WHEN** recommendation requests are queried for a user in descending request time
- **THEN** the stored context and status are available in newest-first order

#### Scenario: Invalid request snapshot is rejected
- **WHEN** a request contains invalid coordinates, a negative or reversed budget, or a non-positive maximum distance
- **THEN** the database rejects the request

### Requirement: Ranked recommendation results
The system SHALL store results under a request with a positive unique rank, bounded base and final scores, a dish, an optional restaurant, a user-facing reason, and structured safety warnings.

#### Scenario: Ranked results are stored
- **WHEN** multiple valid results are recorded for one request with distinct ranks
- **THEN** they can be retrieved in rank order with their scores, reason, and safety warnings

#### Scenario: Duplicate rank is rejected
- **WHEN** two results under the same request use the same rank
- **THEN** the database rejects the duplicate rank

#### Scenario: Invalid rank or score is rejected
- **WHEN** a result has a non-positive rank or a score outside 0–100
- **THEN** the database rejects the result

### Requirement: Idempotent user interactions
The system SHALL record supported interaction types against a user and dish with a globally unique idempotency key, and MAY link the interaction to a recommendation result and restaurant.

#### Scenario: Feedback is retried
- **WHEN** the same idempotency key is submitted more than once
- **THEN** the duplicate interaction is rejected so the event is counted once

#### Scenario: Interaction history is queried
- **WHEN** interactions are queried for a user in descending creation time
- **THEN** their typed dish and recommendation context is available newest first

### Requirement: Rating semantics
The system SHALL accept ratings only from 1 through 5 for `RATED` interactions and SHALL reject a missing rating for `RATED` or a rating attached to another interaction type.

#### Scenario: Valid rating is stored
- **WHEN** a `RATED` interaction includes an integer rating from 1 through 5
- **THEN** the interaction is stored

#### Scenario: Invalid rating is rejected
- **WHEN** a rating is outside 1–5, missing for `RATED`, or present for a non-rating interaction
- **THEN** the database rejects the interaction

### Requirement: Recommendation privacy boundary
Recommendation persistence SHALL contain user-facing reasons and structured safety warnings but SHALL NOT provide fields for chain-of-thought, secret prompts, credentials, or raw private model reasoning.

#### Scenario: Result is persisted
- **WHEN** a recommendation result is stored
- **THEN** only the defined result metadata is persisted and no private reasoning field is available

### Requirement: Referential lifecycle
Deleting a user SHALL remove that user's recommendation requests and interactions, deleting a request SHALL remove its results, and referenced dish or restaurant catalog records SHALL remain protected while history depends on them.

#### Scenario: User is deleted
- **WHEN** a user with recommendation history is deleted
- **THEN** their requests, results, and interactions are removed through cascades

#### Scenario: Referenced catalog record is deleted
- **WHEN** deletion is attempted for a dish or restaurant referenced by retained history
- **THEN** the database rejects the deletion
