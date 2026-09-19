## Context

DB01 and DB02 established PostgreSQL, the Prisma migration workflow, users, taste profiles, and normalized cuisine/allergen catalogs. DB03 must connect new dish data to those catalogs while preserving the migration-first and idempotent-seed conventions. See `proposal.md` and `specs/dish-knowledge-base/spec.md` for scope and behavior.

## Goals / Non-Goals

**Goals:**

- Represent canonical dishes, alternate names, ingredients, allergen evidence, and user dish preferences with database-enforced integrity.
- Make canonical-name/slug and normalized-alias lookup efficient without requiring full-text search.
- Keep safety evidence explicit and distinguish unknown data from verified safety facts.
- Provide a small repeatable Vietnamese seed dataset and integration coverage.

**Non-Goals:**

- Restaurant menus, availability, geospatial queries, and Places provider data (DB04).
- Recommendation scoring, automatic safety decisions, embeddings, or fuzzy/full-text search.
- Exhaustive coverage of Vietnamese dishes or medical certification of seed data.

## Decisions

### Use catalog models plus explicit join models

`Dish` uses UUID identity and a stable unique slug, and references the existing `Cuisine` catalog. `Ingredient` uses a stable unique code. Explicit `DishIngredient`, `DishAllergen`, and `UserDishPreference` models preserve room for mapping metadata and provide composite primary keys that prevent duplicate pairs.

Implicit many-to-many relations were rejected because allergen mappings require evidence and verification metadata, and explicit models keep all relationships consistent.

### Normalize aliases before persistence

Each alias stores display text and `normalizedAlias`. A composite uniqueness constraint on `(dishId, normalizedAlias)` prevents duplicate aliases for one dish, while a non-unique index on `normalizedAlias` supports lookup and permits genuinely ambiguous names to map to multiple dishes. Application/seed code performs trim, lowercase, Unicode normalization, and Vietnamese diacritic removal before writing the normalized value.

A globally unique alias was rejected because the same regional name can refer to more than one canonical dish.

### Enforce numeric and safety invariants in PostgreSQL

Prisma types express small integers and relations; the migration adds named check constraints for price ranges, 0–100 flavor scores, non-blank evidence, and the rule that `VERIFIED` allergen mappings require `verified_at`. This mirrors the DB02 approach and protects data regardless of the caller.

Application-only validation was rejected because imports and future services may write through different code paths.

### Treat deletion according to ownership

Deleting a dish cascades to its aliases, ingredient mappings, allergen mappings, and user preferences. Deleting a user cascades to that user's dish preferences. Deleting referenced catalog entries (`Cuisine`, `Ingredient`, or `Allergen`) is restricted while mappings exist so catalog cleanup cannot silently erase knowledge.

### Seed from stable natural keys

Seed upserts cuisines/allergens first, then ingredients by code and dishes by slug. It resolves IDs and upserts all join records through composite unique keys. Seed allergen evidence is conservative and retains its declared verification status; it is sample knowledge, not a claim that unlisted allergens are absent.

## Risks / Trade-offs

- [Alias normalization can collapse distinct spellings] → Retain the original display alias and scope uniqueness to a dish.
- [Seed allergen evidence can become stale] → Store evidence source and verification status explicitly and keep the initial dataset small.
- [Hard-coded check constraints are not represented fully in Prisma schema] → Give constraints stable names and cover them with migration integration tests.
- [Exact normalized lookup does not support typos] → Defer fuzzy/full-text search until observed query needs justify it.

## Migration Plan

1. Add enums and tables in a forward-only `add_dish_knowledge_base` migration.
2. Add foreign keys, composite primary/unique keys, lookup indexes, and named check constraints.
3. Regenerate Prisma Client and run the migration against local PostgreSQL.
4. Run the extended seed twice and execute database integration tests.
5. Roll back before shared deployment by reverting application code and dropping the DB03 objects in dependency order; after shared deployment, correct issues with a new forward migration rather than editing migration history.
