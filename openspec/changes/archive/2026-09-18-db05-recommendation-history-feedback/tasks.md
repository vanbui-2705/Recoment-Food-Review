## 1. Schema and Migration

- [x] 1.1 Add recommendation/meal/interaction enums and the request, result, and interaction models with relations
- [x] 1.2 Add the DB05 migration with chronological indexes, unique keys, foreign keys, and named checks
- [x] 1.3 Generate and validate Prisma Client

## 2. Recommendation History Verification

- [x] 2.1 Test valid request context, chronological user history, and request constraints
- [x] 2.2 Test ranked results, unique ranks, score constraints, structured warnings, and catalog protection

## 3. Feedback Verification

- [x] 3.1 Test idempotency keys, chronological interaction history, and optional result linkage
- [x] 3.2 Test rating semantics and user/request cascade behavior

## 4. End-to-End Database Verification

- [x] 4.1 Apply DB05 incrementally and replay all migrations on a clean database
- [x] 4.2 Run database tests, build, typecheck, lint, unit tests, and formatting checks

## 5. Project Record

- [x] 5.1 Mark DB05 and the overall database plan complete with the verified migration record
- [x] 5.2 Validate, sync, and archive the completed OpenSpec change
