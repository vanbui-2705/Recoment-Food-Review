## Why

Rec-Food currently stores user taste and allergy constraints but has no canonical dish data against which those constraints can be evaluated. DB03 adds the dish knowledge base required for dish lookup, preference learning, and later restaurant recommendations without treating unverified safety data as trustworthy.

## What Changes

- Add canonical dishes with cuisine, normalized slug, price range, flavor scores, and verification status.
- Add normalized dish aliases so a dish can be found by its canonical name or an alternate name.
- Add a normalized ingredient catalog and dish-to-ingredient mappings.
- Add evidence-backed dish allergen mappings with explicit presence and verification status.
- Add per-user dish like/dislike preferences, kept separate from allergy constraints.
- Extend the idempotent development seed with an initial Vietnamese dish dataset, aliases, ingredients, and allergen evidence.
- Add database integration coverage for constraints, relations, lookup paths, cascading behavior, and repeatable seed imports.

## Capabilities

### New Capabilities

- `dish-knowledge-base`: Canonical dish data, aliases, ingredients, allergen evidence, and user dish preferences used for safe lookup and later recommendation features.

### Modified Capabilities

None.

## Impact

- Extends `backend/prisma/schema.prisma` and adds a new versioned Prisma migration.
- Extends `backend/prisma/seed.ts` with idempotent DB03 catalog data.
- Extends database integration tests for DB03 behavior.
- Adds relations from the existing `User`, `Cuisine`, and `Allergen` models; no external API contract changes are included.
