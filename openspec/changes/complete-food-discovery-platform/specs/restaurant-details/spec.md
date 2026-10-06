## Purpose

Present provider-backed restaurant details and merchant menus with separate venue versus dish photos, ratings, attribution and freshness.

## ADDED Requirements

### Requirement: Attributable detail and menu
The system SHALL display restaurant address, hours, directions, source/freshness and paginated available menu offers when evidence exists; missing menus SHALL NOT be invented.

#### Scenario: Restaurant has no merchant menu
- **WHEN** a user opens a restaurant found only through a place provider
- **THEN** the details show venue information and explain that per-dish menu prices are unconfirmed

### Requirement: Honest media and graceful failure
The system SHALL distinguish venue photos/ratings from dish media/reviews, preserve required attribution, keep credentials private and show meaningful missing-source states.

#### Scenario: Provider photo failure
- **WHEN** a photo provider is unavailable or lacks attribution-compatible media
- **THEN** the UI shows a placeholder and the remaining restaurant information stays usable
