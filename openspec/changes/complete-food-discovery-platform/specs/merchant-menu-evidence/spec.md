## Purpose

Provide attributable merchant menu offers and restaurant-specific safety evidence with explicit freshness and source limitations.

## ADDED Requirements

### Requirement: Offer identity and freshness
The system SHALL import authorized external menu offers idempotently, retaining supplier identity, VND price, availability, source and expiry. Multiple sizes or options SHALL remain distinct offers.

#### Scenario: Repeated import and expiry
- **WHEN** a supplier replays an offer and its evidence later expires
- **THEN** the offer is not duplicated and no expired price is labelled confirmed

### Requirement: Partial failure and missing configuration
The system SHALL report supplier failures and missing credentials and SHALL NOT create artificial menus or mark missing offers unavailable until a complete successful snapshot proves removal.

#### Scenario: Incomplete sync
- **WHEN** a menu snapshot fails midway
- **THEN** previous offers retain their actual evidence expiry and are not all marked unavailable

### Requirement: Restaurant-specific safety evidence
The system SHALL require current attributable ingredient, allergen and cross-contact evidence for automatic allergy-safe candidates; absent, ambiguous, expired or contradictory evidence SHALL NOT prove safety.

#### Scenario: Missing cross-contact evidence
- **WHEN** a user with an allergy has an offer with unknown cross-contact status
- **THEN** automatic safe recommendation excludes the offer and explicit discovery labels the uncertainty
