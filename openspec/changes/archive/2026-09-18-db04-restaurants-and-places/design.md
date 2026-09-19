## Context

DB03 provides stable dish IDs and slugs. DB04 adds the location and menu layer without integrating a live Places API yet. PostgreSQL remains the source of persisted data and Prisma migrations remain the schema-versioning mechanism.

## Goals / Non-Goals

**Goals:**

- Preserve internal restaurant identity independently from provider identity.
- Support provider upserts and manually entered restaurants.
- Store bounded geographic and rating metadata with an explicit cache timestamp.
- Represent the current known restaurant menu through an explicit join model.

**Non-Goals:**

- Calling Google Places, route-distance calculation, PostGIS, menus with size variants, or historical price tracking.
- Recommendation ranking and feedback persistence, which belong to DB05.

## Decisions

### Keep internal UUID and external provider ID separate

`Restaurant.id` is the stable internal key. `googlePlaceId` is nullable and unique, allowing deterministic Google upserts while permitting manually curated restaurants. Using the provider ID as the primary key was rejected because providers may change and not every record has one.

### Use exact decimal coordinates without PostGIS

Latitude and longitude use fixed precision decimals and database check constraints. This avoids floating-point storage surprises and matches the MVP decision to defer PostGIS. Spatial indexing and radius queries can be added when actual query patterns require them.

### Treat Places fields as a timestamped cache

Rating, rating count, price level, business status, and `placesDataUpdatedAt` describe the last fetched provider snapshot. The timestamp remains nullable for manual records. This prevents cached external data from appearing permanently current.

### Use an explicit composite-key menu model

`RestaurantDish` is keyed by `(restaurantId, dishId)` and carries price, availability, source, and verification time. Deleting a restaurant cascades its menu; deletion of a referenced dish is restricted so a catalog operation cannot silently remove availability evidence.

## Risks / Trade-offs

- [Decimal coordinates require conversion at API boundaries] → Keep database precision explicit and serialize deliberately later.
- [A single price cannot represent variants] → Store the representative current price in DB04 and introduce variants only with a demonstrated requirement.
- [External ratings become stale] → Retain `placesDataUpdatedAt` and let future ingestion define refresh policy.
- [Manual restaurants cannot use provider upsert] → Seed records receive stable synthetic Google Place IDs prefixed for development only.

## Migration Plan

1. Add the business-status enum and DB04 tables through a forward migration.
2. Add unique/index/foreign-key and named check constraints.
3. Regenerate Prisma Client, deploy the migration, and run the extended seed twice.
4. Verify incremental and clean-database migration paths plus database integration tests.
