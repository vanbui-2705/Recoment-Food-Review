# External food discovery and cooking

Frontend is connected to the backend through `/api`. Vite proxies to
`http://127.0.0.1:3001`; the production nginx config proxies to the backend service.
No provider credential is sent to the browser or belongs in `VITE_*` variables.

## Configure providers

Fill these variables in `backend/.env`, then restart the backend. Existing secrets
are preserved. `backend/.env.example` documents every integration.

| Variable                | Purpose                                                | Official documentation                                                          |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `GOOGLE_PLACES_API_KEY` | Text search, restaurant hours, ratings, distance       | https://developers.google.com/maps/documentation/places/web-service/text-search |
| `GOONG_API_KEY`         | Keyword autocomplete and place details in Vietnam      | https://document.goong.io/tutorial-Places.html                                  |
| `FOURSQUARE_API_KEY`    | Current Places API with service key, not legacy v3     | https://docs.foursquare.com/fsq-developers-places/reference/place-search        |
| `GEOAPIFY_API_KEY`      | Nearby restaurants; not a dish/menu search             | https://apidocs.geoapify.com/docs/places/places/                                |
| `THEMEALDB_API_KEY`     | Recipes, ingredients, instructions, source/video links | https://themealdb.com/docs_api_guide.php                                        |
| `SPOONACULAR_API_KEY`   | Recipe search and full recipe details                  | https://spoonacular.com/food-api/docs                                           |

Blank keys disable only their source. You do not need all six keys to run the app.
TheMealDB's `1` key is for development/testing; obtain a supporter key before public
release. Providers have separate quotas and terms. Enable Places API (New) and
billing for Google, and restrict its key to the server/API. Foursquare uses
`https://places-api.foursquare.com`, Bearer authentication and version `2025-06-17`.

## Backend and UI

All endpoints require an authenticated user. Responses use the existing
`{ data: ... }` envelope. Search endpoints return per-source status without secrets.

| Endpoint                                 | Behavior                                                 |
| ---------------------------------------- | -------------------------------------------------------- |
| `GET /discovery/sources`                 | Six providers and configuration status; no keys          |
| `GET /discovery/restaurants?q=...`       | Free-text dish/place query; no internal dish ID required |
| `GET /recipes?q=...`                     | Search both recipe providers automatically               |
| `GET /recipes/today`                     | Fetch cooking ideas on app entry; apply 96-hour cooldown |
| `GET /recipes/:source/:id`               | Full ingredients, cooking steps, source/video links      |
| `POST /recipes/:source/:id/interactions` | Record CHOSEN/EATEN with UUID idempotency key            |
| `GET /users/me/recipe-history`           | Current user's cooking history                           |

Restaurant query options: `source=google|goong|foursquare|geoapify`, paired
`latitude`/`longitude`, `radius=100..50000` meters, `openNow=true|false`. Without
coordinates, the server uses the saved profile location and radius. Unknown hours
do not pass the open-now filter. Distances are straight-line, not driving distances.
Recipe search accepts `source=themealdb|spoonacular`. Unsupported sources and
invalid IDs/coordinates are rejected before upstream requests.

`Tìm món / Nấu ăn` provides separate restaurant and cooking modes, source/radius
selection, optional current location, loading/empty/error states, and results with
attribution. Recipe detail has an ingredient checklist, previous/next cooking step,
complete instructions, source/video links, and choose/eaten/yesterday actions.
Existing dish details link into both modes. The home page automatically loads
cooking ideas beside the existing personalized dish recommendations.

## History and recommendation rules

The migration `20261006090000_external_discovery` adds `recipe_interactions`.
Apply it with `npm run db:migrate:deploy` in `backend` before starting the app.
It retains only provider/recipe identity, title and user action; provider recipe
content and place results are fetched live and not written into the database.

The server fetches a recipe's actual title before accepting the first interaction;
it does not trust a client-provided title. Idempotent retries can succeed without
calling an unavailable provider again. Eaten timestamps may be backdated up to
30 days. Exactly 96 hours after the recorded action, the cooldown expires.

Cooldown is shared between recipe and knowledge-bank recommendations through
normalized names, explicit pho equivalents (e.g. Beef pho / Phở bò), and known dish aliases. Matching names across providers are
deduplicated. Unknown translations or semantically different recipe names are
not inferred to be identical; extend the existing alias catalog when evidence is
available. Explicit searches are never filtered by recommendation cooldown.
Daily cooking ideas are ordered deterministically per user and Vietnam calendar
day for the same source results, but upstream catalog changes can change them.

Cooking ideas have no invented restaurant price or taste score. They are shown
as ideas, not certified matches to the user's budget or taste. Automatic external
recipes fail closed when the profile has allergies or mandatory dietary restrictions,
because provider metadata cannot prove merchant cross-contact safety. Explicit
search remains available with clear ingredient/source information.

## Reliability, cost and limits

Sources run independently: missing keys, quota failures or malformed responses
do not hide healthy sources. Requests have deadlines, reject redirects, and bound
decoded JSON responses to 3 MB. Goong uses at most five place-detail requests per
search. Discovery endpoints share a 15 requests/minute/IP limiter; provider JSON
requests have an additional configurable 120 requests/minute/source cap, including Google.
These limits now use atomic PostgreSQL counters shared across web/worker replicas;
authenticated limits use owner identity, public auth endpoints use verified client IP.
The same SECURITY_NAMESPACE must be used in one deployment. Provider-side billing
limits remain necessary. Do not enable shared caching of Google content.

Place results are labelled by source and evidence: Google/Foursquare/Goong are
keyword-related places, while Geoapify supplies nearby restaurants. None certifies
a merchant's current menu, per-dish price, availability or allergen safety. Provider
coverage for Vietnamese recipes must be measured with real keys. Recipe instructions
remain in the source language; the application does not fabricate a translation.

GrabFood's official SDK is a merchant/partner integration, not a public catalog
endpoint for every restaurant. This change integrates the six public providers
listed above. It does not fabricate GrabFood/ShopeeFood integrations or call private
mobile-app endpoints. Partner menu access needs a separate documented agreement.

TheMealDB's development key was smoke-tested against a live search for `pho` and
recipe detail: `Beef pho` returned ingredients and cooking instructions. Other
authenticated providers cannot be fully verified until real keys are configured.
Automated tests use provider contract fixtures to check request shapes,
normalization, attribution, failure isolation, history, authentication and cooldown.

Historical discovery checkpoint: backend TypeScript build/lint; 37 unit/integration tests;
49 database tests; 12 desktop/mobile browser tests. After the final identity and
navigation changes, relevant database/provider/browser tests were rerun. A live
TheMealDB smoke test used authenticated backend routes to fetch a recipe, record
history, and verify the shared pho cooldown. A real browser also exercised the
running frontend `/api` proxy with register/login, location validation and missing-key
states. Temporary smoke-test users were removed afterwards.

Current full-system validation and code-ready/live-ready boundaries are recorded in
[RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md). The older TheMealDB development-key smoke
is not a production credential or a current release gate. Merchant sync has a bounded
schedule/lease/retry engine but no production supplier adapter until official contract
and permission are provided. See [sync validation](PLAN_MENU_SYNC_VALIDATION.md).
