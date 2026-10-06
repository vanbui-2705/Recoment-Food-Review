## Purpose

Collect private attributable feedback and data reports while allowing users to manage history without silently changing safety constraints.

## ADDED Requirements

### Requirement: Valid idempotent feedback
The system SHALL validate feedback ownership and type, accept integer ratings 1–5 only for rating actions, prevent duplicate submissions, and use feedback only for soft preferences.

#### Scenario: Retried rating
- **WHEN** the owner retries an identical rating feedback idempotency key
- **THEN** one rating is recorded and allergy or mandatory diet constraints are unchanged

### Requirement: History management and reports
The system SHALL offer cursor-paginated owner history and explicit deletion with a cooldown-impact preview, and allow attributable reports of incorrect data with review status.

#### Scenario: Deletion affects cooldown
- **WHEN** a user requests deletion of a chosen/eaten history event
- **THEN** the UI explains the cooldown effect before confirmation and no other user's history changes
