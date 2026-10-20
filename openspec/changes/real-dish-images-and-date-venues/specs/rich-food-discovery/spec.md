## Purpose

Provide a visually credible discovery experience where users see personalized, image-backed dishes across suitable spending levels and can intentionally search for nearby date-friendly restaurants.

## ADDED Requirements

### Requirement: Catalog dishes lead the recommendation experience
The system SHALL present personalized catalog dishes before external recipe inspiration whenever at least one safe catalog dish is available.

#### Scenario: Catalog and recipe results are both available
- **WHEN** the main discovery screen receives one or more catalog dishes and one or more external recipes
- **THEN** the hero and first recommendation grid SHALL contain catalog dishes and external recipes SHALL appear in a clearly labeled secondary section

### Requirement: Dish recommendations render sourced imagery
The system SHALL expose and render a sourced image for curated catalog dishes, including meaningful alternative text, and MUST show an honest unavailable state for legacy dishes whose image source is absent or fails to load.

#### Scenario: Curated dish has an image
- **WHEN** a curated catalog dish appears in the hero or recommendation grid
- **THEN** the card SHALL render the dish image with the dish name as alternative text

#### Scenario: Dish image cannot be loaded
- **WHEN** a recommendation has no image source or its image fails to load
- **THEN** the card SHALL render an explicit image-unavailable state and MUST NOT substitute an unrelated food photo

### Requirement: Catalog represents multiple spending occasions
The curated catalog SHALL contain safe recommendation candidates spanning affordable, everyday, premium, and special-occasion price bands, while recommendation filtering MUST continue to respect the user's saved maximum budget.

#### Scenario: User has a broad budget
- **WHEN** the user's budget permits candidates from multiple price bands
- **THEN** the visible catalog recommendations SHALL include multiple price bands when safe matching dishes exist

#### Scenario: User has a constrained budget
- **WHEN** a premium or special-occasion dish exceeds the user's maximum budget
- **THEN** the system MUST exclude that dish rather than relaxing the budget constraint for visual diversity

### Requirement: User can search for a date-friendly restaurant
The main discovery screen SHALL provide a dedicated date-venue action that searches nearby restaurants using the user's current or saved coordinates and a date-friendly intent.

#### Scenario: User searches for a date venue with saved coordinates
- **WHEN** the user activates `Tìm quán đi date` and a saved location is available
- **THEN** the frontend SHALL request nearby restaurants with a date-friendly query and SHALL present returned places without recording a dish `CHOSEN` interaction

#### Scenario: Date search needs device location
- **WHEN** no valid saved coordinates are available and the user activates the date-venue action
- **THEN** the frontend SHALL request device location and SHALL show an actionable location error if permission is denied

### Requirement: Live-stack flow is regression tested
The release validation SHALL exercise the built frontend and backend together and verify that catalog dishes with images render before recipe inspiration on desktop and mobile.

#### Scenario: Port 8081 smoke test
- **WHEN** the Docker stack is running with curated data
- **THEN** an authenticated browser smoke test SHALL observe image-backed catalog cards and a working date-venue restaurant request through port 8081
