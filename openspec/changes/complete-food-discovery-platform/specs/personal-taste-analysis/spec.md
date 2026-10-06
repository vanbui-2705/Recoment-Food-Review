## Purpose

Turn free-text taste descriptions into account-owned, validated knowledge while preserving source revisions and unresolved safety constraints.

## ADDED Requirements

### Requirement: Revision-safe extraction
The system SHALL analyze the latest saved description and atomically apply validated knowledge only when its source revision still matches; stale results SHALL NOT mark newer text analyzed.

#### Scenario: Description changes during analysis
- **WHEN** a result finishes for an older revision
- **THEN** the result is superseded and the newer description and profile are not overwritten

### Requirement: Safety review and availability
The system SHALL retain a single free-text taste input, show analysis status/retry, preserve existing safety constraints, and require review for ambiguous or changed safety constraints. Missing credentials SHALL NOT block explicit discovery.

#### Scenario: Ambiguous allergy
- **WHEN** an analysis cannot resolve an allergy or mandatory diet
- **THEN** the UI requests clarification and automatic personalized recommendations remain pending

### Requirement: Idempotent recoverable analysis
The system SHALL prevent duplicate jobs for the same source revision and recover bounded retries after worker interruption without applying knowledge twice.

#### Scenario: Worker interruption
- **WHEN** a running analysis is interrupted and later retried
- **THEN** only one valid result can be applied and the owner sees a recoverable status
