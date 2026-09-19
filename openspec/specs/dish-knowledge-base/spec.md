# dish-knowledge-base Specification

## Purpose

Provide a canonical, searchable dish catalog with traceable allergen evidence and user preferences that downstream recommendation features can use safely.

## Requirements

### Requirement: Canonical dish records
The system SHALL persist each dish under a unique stable slug, associate it with a cuisine, store a valid VND price range and 0–100 flavor scores, and retain an explicit verification status.

#### Scenario: Valid dish is stored
- **WHEN** a dish has a unique slug, an existing cuisine, non-negative prices with minimum not greater than maximum, flavor scores within 0–100, and a valid verification status
- **THEN** the system stores the dish and its canonical metadata

#### Scenario: Invalid dish metadata is rejected
- **WHEN** a dish has an invalid price range or any flavor score outside 0–100
- **THEN** the database rejects the record

### Requirement: Searchable alternate dish names
The system SHALL retain normalized alternate names for dishes, prevent the same normalized alias from being duplicated for one dish, and support lookup through either canonical identity or normalized alias.

#### Scenario: Dish is found by alias
- **WHEN** a consumer searches using a stored normalized alias
- **THEN** the corresponding canonical dish can be retrieved

#### Scenario: Duplicate alias mapping is rejected
- **WHEN** the same normalized alias is added to the same dish more than once
- **THEN** the database rejects the duplicate mapping

### Requirement: Normalized ingredient composition
The system SHALL maintain ingredients under stable unique codes and SHALL map dishes to ingredients without allowing duplicate dish-ingredient pairs.

#### Scenario: Ingredient composition is recorded
- **WHEN** an existing ingredient is associated with an existing dish
- **THEN** the system stores one composition mapping for that pair

#### Scenario: Duplicate composition is rejected
- **WHEN** the same ingredient is associated with the same dish again
- **THEN** the database rejects the duplicate mapping

### Requirement: Traceable dish allergen evidence
Every dish-allergen mapping SHALL specify whether the dish contains or may contain the allergen, an explicit verification status, and a non-empty evidence source. A verified mapping SHALL include the time it was verified, and absence of a mapping SHALL NOT be interpreted as evidence that a dish is safe.

#### Scenario: Evidence-backed allergen mapping is stored
- **WHEN** an allergen mapping includes presence, verification status, and a non-empty evidence source
- **THEN** the system stores the mapping without changing its stated verification status

#### Scenario: Verified mapping lacks verification time
- **WHEN** a mapping is marked verified without a verification timestamp
- **THEN** the database rejects the mapping

#### Scenario: Allergen mapping is not duplicated
- **WHEN** the same allergen is mapped to the same dish again
- **THEN** the database rejects the duplicate mapping

### Requirement: Dish likes and dislikes remain separate from safety constraints
The system SHALL allow one liked or disliked preference per user and dish, SHALL allow that preference to be updated, and SHALL NOT represent allergies through this preference.

#### Scenario: User preference is recorded
- **WHEN** a user marks a dish as liked or disliked
- **THEN** the system stores exactly one current preference for that user-dish pair

#### Scenario: User preference changes
- **WHEN** a user changes an existing dish preference from liked to disliked or vice versa
- **THEN** the current preference is updated without creating a second pair

### Requirement: Repeatable initial dish import
The development seed SHALL import an initial Vietnamese dish catalog, aliases, ingredients, and allergen evidence idempotently.

#### Scenario: Seed is executed twice
- **WHEN** the DB03 seed runs repeatedly against the same database
- **THEN** the second and later runs do not create duplicate dishes, aliases, ingredients, ingredient mappings, or allergen mappings
