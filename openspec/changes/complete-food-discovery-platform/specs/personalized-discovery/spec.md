## Purpose

Deliver automatic personalized nearby recommendations from verified candidates with reliable ranking, traceable reasons and a four-day repeat exclusion.

## ADDED Requirements

### Requirement: Automatic home discovery
The system SHALL automatically load suggestions using valid account budget and location context, offer GPS when location is absent, respect a 3000–4000 meter radius and ignore superseded responses.

#### Scenario: Home without location
- **WHEN** the user opens the app without a valid location
- **THEN** the UI offers location access without repeated automatic permission prompts or fabricated nearby results

### Requirement: Hard constraints and cooldown
The system SHALL enforce safety, mandatory diet, actual budget, distance, availability and 96-hour CHOSEN/EATEN exclusion before ranking; unpriced venues SHALL remain separate and wheel inclusion SHALL require opt-in.

#### Scenario: Cooldown across sources
- **WHEN** a known canonical dish was chosen within the previous 96 hours
- **THEN** the same dish is excluded from verified candidates and the wheel without relaxing constraints

### Requirement: Validated LLM fallback and history
The system SHALL restrict LLM output to eligible candidate IDs and grounded reasons, fall back to deterministic normalized ranking on failure, and expose recommendation snapshots only to their owner.

#### Scenario: Invented candidate
- **WHEN** the LLM returns an ID outside the candidate set or times out
- **THEN** the system returns valid deterministic candidates and a fallback status without invented data
