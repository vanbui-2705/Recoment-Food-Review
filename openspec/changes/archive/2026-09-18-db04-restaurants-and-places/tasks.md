## 1. Schema and Migration

- [x] 1.1 Add restaurant status enum, Restaurant and RestaurantDish models, and Dish relations
- [x] 1.2 Add the DB04 migration with provider identity, lookup indexes, foreign keys, and check constraints
- [x] 1.3 Generate and validate Prisma Client

## 2. Seed Data

- [x] 2.1 Add stable sample restaurant and menu definitions
- [x] 2.2 Implement idempotent restaurant and restaurant-dish upserts
- [x] 2.3 Run the seed twice and verify restaurant/menu counts remain stable

## 3. Verification

- [x] 3.1 Test provider upserts, nullable provider IDs, and place metadata constraints
- [x] 3.2 Test menu uniqueness, evidence constraints, and cascade/restrict behavior
- [x] 3.3 Verify incremental and clean-database migrations, database tests, and backend quality checks

## 4. Project Record

- [x] 4.1 Update the database plan with the verified DB04 implementation record
- [x] 4.2 Validate, sync, and archive the completed OpenSpec change
