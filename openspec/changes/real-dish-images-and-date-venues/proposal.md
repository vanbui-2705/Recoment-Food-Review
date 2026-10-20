## Why

The live discovery screen receives real catalog dishes but visually promotes external recipe ideas first, while catalog dishes have no image contract and are easy to miss. Users also need intentional discovery paths for different spending levels and for finding a suitable restaurant for a date, not only searching by a dish name.

## What Changes

- Make personalized catalog dishes the primary hero and recommendation grid; keep external recipes in a clearly secondary inspiration section.
- Add sourced dish imagery to the catalog/API contract and require every visible recommendation card to render a useful image state.
- Expand the curated catalog across affordable, everyday, premium, and special-occasion price bands while continuing to respect the user's saved budget and dietary safety constraints.
- Add a dedicated `Tìm quán đi date` action that searches nearby restaurants with a date-friendly intent and real user/profile coordinates.
- Preserve the dish-first restaurant confirmation flow and its final-confirmation-only cooldown behavior.
- Add real-stack desktop/mobile regression coverage through port 8081 in addition to mocked component tests.

## Capabilities

### New Capabilities

- `rich-food-discovery`: Covers image-backed catalog recommendations, diverse price-band discovery, catalog-first visual hierarchy, and date-venue restaurant search.

### Modified Capabilities


## Impact

- Prisma dish schema and migration, curated seed data, food response mapping, frontend dashboard adapters, and `DiscoveryPage`.
- Restaurant discovery requests gain an explicit client-side occasion intent through the existing query contract; no new external provider dependency is required.
- Docker images and seeded local data must be rebuilt/reseeded for smoke validation.
