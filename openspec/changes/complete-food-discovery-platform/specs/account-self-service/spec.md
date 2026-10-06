## Purpose

Allow secure account maintenance, email recovery and personal data management using owner authorization and explicit confirmation.

## ADDED Requirements

### Requirement: Password and email lifecycle
The system SHALL provide password-change UI, secure single-use expiring email/reset tokens, generic forgot-password responses and revocation of sessions after reset.

#### Scenario: Replayed reset token
- **WHEN** a password-reset token is expired or already consumed
- **THEN** the reset is rejected without changing credentials or revealing another user's account

### Requirement: Personal data controls
The system SHALL require recent authentication for account export/deletion, exclude secrets and restricted provider content from exports, and disclose retention and deletion consequences.

#### Scenario: Account deletion
- **WHEN** the authenticated owner explicitly confirms deletion after re-authentication
- **THEN** sessions are revoked and owned data enters the documented cleanup lifecycle without deleting other accounts

### Requirement: Missing email provider
The system SHALL surface an unavailable email capability without exposing provider secrets or pretending a recovery email was delivered.

#### Scenario: Unconfigured email
- **WHEN** a recovery flow needs a disabled email provider
- **THEN** the response reports a controlled capability state with no fabricated delivery success
