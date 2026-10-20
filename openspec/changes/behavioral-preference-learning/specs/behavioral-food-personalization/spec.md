## Purpose

Personalize food ranking from each user's recent, explicit and behavioral signals while keeping eligibility constraints, privacy, diversity, and user-facing explanations intact.

## ADDED Requirements

### Requirement: Private behavioral affinity
The system SHALL derive affinity only from the authenticated user's own dish preferences and interactions, SHALL weight explicit outcomes more strongly than passive views, and SHALL decay older signals.

#### Scenario: Similar dish receives a learned boost
- **WHEN** a user repeatedly likes, chooses, eats, or positively rates a dish
- **THEN** future eligible dishes with similar cuisine, flavor profile, or price band receive a bounded positive ranking adjustment for that user

#### Scenario: Negative signal reduces similar recommendations
- **WHEN** a user skips, dislikes, or negatively rates a dish
- **THEN** that dish and similar eligible dishes receive a bounded negative ranking adjustment for that user

#### Scenario: Passive exposure is weak evidence
- **WHEN** a dish is merely viewed without a stronger outcome
- **THEN** the view contributes less affinity than a like, choice, eaten confirmation, skip, or rating

#### Scenario: User isolation
- **WHEN** one user submits behavioral feedback
- **THEN** another user's ranking and learning summary remain unchanged

### Requirement: Constraints precede personalization
Behavioral ranking SHALL NOT make a dish eligible when it fails allergy, mandatory diet, budget, meal-period, active-catalog, or repeat-cooldown rules.

#### Scenario: Learned favorite violates a hard constraint
- **WHEN** a strongly preferred dish fails a current hard eligibility rule
- **THEN** the dish is excluded rather than promoted

### Requirement: Bounded learning and exploration
The system SHALL bound behavioral score adjustments so onboarding taste and operational ranking factors remain meaningful, and SHALL retain diverse eligible alternatives instead of returning only one learned cuisine or price band.

#### Scenario: Repeated feedback cannot dominate indefinitely
- **WHEN** many duplicate or repeated signals target the same preference pattern
- **THEN** the behavioral contribution remains within the documented ranking bound

#### Scenario: Sparse-history user receives recommendations
- **WHEN** a user has too few behavioral signals for confident learning
- **THEN** the system falls back to onboarding preferences and still returns diverse eligible dishes

### Requirement: Grounded learning explanation
Each personalized response SHALL expose a compact learning summary and SHALL identify when a result was materially influenced by behavioral affinity without exposing private model reasoning.

#### Scenario: Learned ranking is visible
- **WHEN** behavioral affinity materially raises an eligible dish
- **THEN** the response includes a user-facing reason grounded in the user's own preference pattern and reports the learning sample size and confidence

#### Scenario: No learned evidence
- **WHEN** the user has no meaningful behavioral signals
- **THEN** the response identifies cold-start learning state and does not claim that behavior influenced the result

### Requirement: Discovery feedback loop
The discovery screen SHALL render real recommended dishes and SHALL provide accessible controls to like, skip as not relevant, choose, and observe that future ordering has been refreshed from saved feedback.

#### Scenario: User marks a dish as not relevant
- **WHEN** the user activates the not-for-me control
- **THEN** the signal is saved once, the card leaves the active recommendation set, and the screen communicates that future suggestions will adapt

#### Scenario: Visible dish dwell is recorded
- **WHEN** the primary dish remains visibly presented for the configured dwell interval
- **THEN** one idempotent view event is recorded without being represented as a like

