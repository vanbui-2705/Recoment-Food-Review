## Purpose

Provide normalized restaurant locations and menu mappings so recommendation results can identify where a dish is available and whether cached place data is current.

## ADDED Requirements

### Requirement: Restaurant place identity
The system SHALL assign each restaurant an internal identity and SHALL allow an optional Google Place ID that is unique when present.

#### Scenario: Provider restaurant is imported again
- **WHEN** place data with an existing Google Place ID is imported again
- **THEN** the existing restaurant can be updated without creating a duplicate

#### Scenario: Manually entered restaurant has no provider ID
- **WHEN** a restaurant is created from a non-Google source
- **THEN** it can be stored with a null Google Place ID

### Requirement: Valid cached place metadata
The system SHALL store address, latitude, longitude, rating, rating count, price level, business status, and cache timestamp while rejecting values outside their valid ranges.

#### Scenario: Valid place metadata is stored
- **WHEN** coordinates, rating, rating count, and price level are within their supported ranges
- **THEN** the restaurant and its cache timestamp are stored

#### Scenario: Invalid place metadata is rejected
- **WHEN** latitude, longitude, rating, rating count, or price level is outside its supported range
- **THEN** the database rejects the record

### Requirement: Restaurant menu mapping
The system SHALL map a dish to a restaurant at most once and SHALL retain its non-negative VND price, availability, non-empty source, verification timestamp, and update timestamp.

#### Scenario: Dish availability is recorded
- **WHEN** an existing dish is offered by an existing restaurant with a valid price and source
- **THEN** one restaurant-dish mapping is stored

#### Scenario: Duplicate menu mapping is rejected
- **WHEN** the same dish is mapped to the same restaurant again as a new record
- **THEN** the database rejects the duplicate mapping

#### Scenario: Invalid menu evidence is rejected
- **WHEN** a menu mapping has a negative price or blank source
- **THEN** the database rejects the mapping

### Requirement: Repeatable sample restaurant import
The development seed SHALL import sample restaurants and restaurant-dish mappings idempotently using stable provider IDs or stable internal seed identifiers.

#### Scenario: Restaurant seed runs repeatedly
- **WHEN** the DB04 seed runs more than once
- **THEN** later runs update the same restaurants and menu mappings without adding duplicates
