## 1. Prisma Schema and Migration

- [x] 1.1 Add DB03 enums, dish/catalog models, join models, and relations to the Prisma schema
- [x] 1.2 Create the `add_dish_knowledge_base` migration with indexes, foreign keys, and named check constraints
- [x] 1.3 Generate Prisma Client and verify schema formatting/validation

## 2. Repeatable Seed Data

- [x] 2.1 Add alias normalization and stable DB03 ingredient/dish seed definitions
- [x] 2.2 Upsert dishes, aliases, ingredient mappings, and evidence-backed allergen mappings through stable keys
- [x] 2.3 Run the complete seed twice and verify DB03 row counts remain stable

## 3. Database Verification

- [x] 3.1 Add integration tests for dish price/flavor constraints and canonical/alias lookup
- [x] 3.2 Add integration tests for unique mappings, allergen evidence rules, and user dish preferences
- [x] 3.3 Add integration tests for DB03 cascade/restrict behavior
- [x] 3.4 Run database tests and the standard backend quality checks

## 4. Project Record

- [x] 4.1 Update the database plan status and DB03 implementation record with the verified migration
- [x] 4.2 Validate the OpenSpec change in strict mode
