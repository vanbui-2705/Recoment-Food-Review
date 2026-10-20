## Context

See `proposal.md` - Why. The current backend catalog response contains real personalized dishes but `Dish` has no image field. `DiscoveryPage` merges catalog dishes with TheMealDB recipes, then promotes the first image-bearing recipe to hero, which reverses the intended trust hierarchy. Restaurant discovery already accepts free-text queries and coordinates, so the date flow can reuse it.

## Goals / Non-Goals

**Goals:**

- Make the catalog the primary visual narrative without weakening allergy, dietary, cooldown, meal-period, or budget filters.
- Keep imagery attributable and deterministic across local, test, and Docker environments.
- Give users an occasion-first date search alongside dish-first search.
- Cover the live composed stack as well as isolated mocked UI tests.

**Non-Goals:**

- Do not claim that a nearby provider result is romantic, premium, or serves a specific dish unless the provider supplies that evidence.
- Do not rank users into expensive food when it exceeds their saved budget.
- Do not introduce a new maps or image provider dependency.
- Do not redesign navigation, typography, or the existing orange/neutral visual system.

## Decisions

### Store an optional sourced image URL on each dish

Add `Dish.imageUrl` and `Dish.imageAttribution` as nullable fields so existing editorial data migrates safely. Curated seed dishes receive reviewed sources. The API returns both fields unchanged, and the UI uses the URL only for that dish.

Alternative: infer images by dish name in the frontend. Rejected because name-based mappings drift from admin data and make the API contract incomplete.

### Bundle curated image assets with the frontend

Download reviewed, reusable food photographs into `frontend/public/images/dishes` and store same-origin `/images/dishes/<slug>.<ext>` URLs in curated seed data. Record source and license attribution in seed metadata/documentation instead of hotlinking third-party hosts.

Alternative: remote hotlinks. Rejected because availability, referrer policies, and content changes make the UX non-deterministic.

### Partition catalog and recipe cards before choosing the hero

Adapters continue to preserve source identity. `DiscoveryPage` filters/searches catalog and recipe groups separately, picks the first catalog dish as hero, renders remaining catalog dishes in the main grid, and renders recipes in a subordinate inspiration section. Image presence no longer outranks catalog trust.

Alternative: a single score across both sources. Rejected because TheMealDB items have no verified personalization score comparable to catalog dishes.

### Derive price-band labels from the existing price range

The client derives four display bands from `priceMax` for browsing and labels only; backend budget filtering remains authoritative. Seed data is expanded with dishes whose ranges exercise each band.

Alternative: persist a new price-tier enum. Rejected because it duplicates numeric price evidence and would require ongoing editorial synchronization.

### Reuse restaurant discovery for the date intent

Add a prominent `Tìm quán đi date` action that calls the existing restaurant search with the Vietnamese query `nhà hàng lãng mạn đi date`, current GPS when explicitly granted, otherwise saved profile coordinates. Results open in the existing restaurant modal but do not offer or record dish confirmation.

Alternative: add a date-specific backend endpoint. Rejected because the provider interface already supports free-text place intent and the new endpoint would duplicate location, quota, and attribution behavior.

## Risks / Trade-offs

- [Curated photos may not match every restaurant preparation] → Label them as representative dish imagery and keep restaurant/menu verification separate.
- [Premium dishes disappear for low-budget profiles] → Preserve safety and budget truth; diversity is offered only inside the allowed range.
- [Free provider may return generic nearby restaurants for a date query] → Preserve provider match labels and never claim romantic suitability without evidence.
- [Existing dishes lack images after migration] → Render an honest unavailable state and let admin/editorial updates add a reviewed source.

## Migration Plan

1. Apply the nullable dish-image migration.
2. Regenerate Prisma client and rebuild backend/frontend images.
3. Run the curated seed to populate image metadata and the expanded dish set without overwriting verified merchant/editorial evidence.
4. Run unit/database/Playwright tests, then execute a desktop/mobile authenticated smoke test through port 8081.
5. Roll back the application images first if needed; nullable database columns can remain without affecting the previous release.
