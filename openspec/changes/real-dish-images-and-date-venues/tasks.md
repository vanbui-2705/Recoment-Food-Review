## 1. Image-backed catalog data

- [x] 1.1 Add nullable sourced image metadata to the Dish schema, migration, generated client, API schemas, and admin/database tests.
- [x] 1.2 Add locally bundled, attributed images and expand curated seed dishes across affordable, everyday, premium, and special-occasion price bands.
- [x] 1.3 Add backend tests proving image metadata is returned and budget filtering still excludes over-budget diversity candidates.

## 2. Catalog-first discovery UX

- [x] 2.1 Add failing frontend regression tests for catalog-first hierarchy, image rendering/fallback, price-band labels, and secondary recipe inspiration.
- [x] 2.2 Refactor dashboard adapters and DiscoveryPage to render the catalog hero/grid before external recipes while retaining filters, likes, and dish-to-restaurant confirmation.
- [x] 2.3 Add and test a responsive `Tìm quán đi date` action that reuses saved/current location, opens provider results, and never records `CHOSEN`.

## 3. Verification and rollout

- [x] 3.1 Run backend generation, typecheck, unit/database tests and frontend build/Playwright tests.
- [x] 3.2 Validate the OpenSpec change, rebuild/reseed Docker services, and run authenticated desktop/mobile smoke tests through port 8081.
