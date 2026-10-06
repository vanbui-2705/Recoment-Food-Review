## Purpose

Provide authorized content ingestion, evidence review, report resolution and account moderation with accountable operations.

## ADDED Requirements

### Requirement: Authorized review and audit
The system SHALL authorize every administrative operation server-side, support idempotent dry-run/commit imports and evidence/report review, and record redacted transactional audit events.

#### Scenario: Unauthorized content mutation
- **WHEN** a USER attempts an admin write
- **THEN** the system returns forbidden without changing content or audit-visible successful state

### Requirement: Moderation and lifecycle protection
The system SHALL revoke sessions when blocking users, prevent disabling the last active ADMIN and preserve referenced history when deactivating catalog content.

#### Scenario: Last administrator
- **WHEN** an operation would disable the final active ADMIN
- **THEN** the operation is rejected and administration remains available
