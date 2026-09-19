## Why

The dish catalog cannot produce actionable nearby recommendations until dishes are connected to restaurants and cached place metadata. DB04 adds that location and menu layer while preserving provider identities and cache freshness.

## What Changes

- Add restaurants with optional unique Google Place IDs, address, coordinates, rating metadata, price level, business status, and Places refresh timestamp.
- Add restaurant-to-dish mappings with VND price, availability, source, and verification timestamp.
- Enforce coordinate, rating, count, price-level, and menu-price invariants in PostgreSQL.
- Extend the idempotent seed with sample restaurants and menu mappings.
- Add database integration tests for provider upserts, unique mappings, constraints, indexes, and deletion behavior.

## Capabilities

### New Capabilities

- `restaurant-place-catalog`: Restaurant place records and evidence-bearing restaurant-to-dish menu mappings for downstream recommendations.

### Modified Capabilities

None.

## Impact

- Extends the Prisma schema, migration history, seed, and database integration tests.
- Adds relations from existing `Dish` records to restaurants.
- Does not call Google Places or expose new HTTP endpoints in this database milestone.
