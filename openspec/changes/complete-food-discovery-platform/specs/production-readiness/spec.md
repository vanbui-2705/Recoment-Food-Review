## Purpose

Make discovery production releases verifiable through complete CI, dependency readiness, privacy-safe observability and rehearsed recovery.

## ADDED Requirements

### Requirement: Release validation
The release process SHALL run backend and frontend builds, migrations, unit/database tests and desktop/mobile browser checks, and SHALL distinguish code-ready from live-provider readiness.

#### Scenario: Provider credentials absent
- **WHEN** all fake-provider tests pass but real credentials or merchant permissions are absent
- **THEN** the release report labels that provider code-ready and not live-ready

### Requirement: Observable safe operation
The system SHALL expose dependency-aware readiness and operational metrics for provider errors, quota, LLM fallback and jobs without logging raw credentials, precise location or taste text; multi-replica quotas SHALL be coordinated.

#### Scenario: Dependency outage
- **WHEN** the database becomes unavailable
- **THEN** readiness signals failure and logs/metrics contain operational identifiers rather than sensitive request data

### Requirement: Backup and rollback rehearsal
The release process SHALL verify isolated database restoration and application rollback with separate migration execution and measured recovery targets.

#### Scenario: Recovery rehearsal
- **WHEN** a backup is restored and the previous application revision is deployed in an isolated environment
- **THEN** ownership and history invariants pass and measured recovery results are recorded
