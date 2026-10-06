# Nearby food discovery and lucky wheel

The home page now starts with a per-person VND budget and a 3 / 3.5 / 4 km radius.
`Tìm món quanh tôi` calls the backend with the saved profile location or an explicit
GPS location. If the account has no saved location, the click requests GPS permission.
This discovery flow works independently of pending AI taste extraction.

`GET /discovery/nearby-food?budget=50000&radius=3500&latitude=10.77&longitude=106.7`
requires authentication. Budget must be 1,000–100,000,000 VND; radius is 3,000–4,000
meters. Both coordinates are required together. The backend filters actual geometric
distance after provider searches, rather than treating location bias as a radius filter.

The response separates:

- `items`: available dishes with a merchant/source menu URL, verified within 24 hours,
  price at or below budget, and an operational restaurant inside the radius.
- `restaurants`: live nearby provider places whose per-dish prices are unknown.
  They must never be labelled as confirmed matches to the entered budget.

Developer seed menus do not qualify as real verified menus. The existing
`restaurant_dishes` table is used for confirmed menu evidence; these public place
APIs do not provide a complete structured menu or exact per-dish prices. Until an
authorized live menu supplier populates that table, the UI shows nearby restaurants
separately and explains the missing price evidence. It does not invent menu items.
Knowledge-bank price estimates are not used as merchant prices.

Selected/eaten dishes within 96 hours and disliked dishes are omitted from confirmed
dish candidates. Cross-source recipe identity follows the existing normalized name
and known alias rules. Fresh live Google ratings and photos can be joined by place ID;
stored Google rating/photo metadata is not assumed current. Ratings and review counts
are explicitly labelled as restaurant ratings, not reviews of the individual dish.
Menu price confirmation does not certify ingredients or allergen safety.

Google Text Search requests `places.photos`. `GET /places/photo?name=places/.../photos/...`
requires authentication, validates the resource format and rate-limits photo access.
The backend uses Place Photos (New) with `skipHttpRedirect=true` and keeps its API key
in a server-side header. The browser receives the credential-free image URL, loads it
on demand with IntersectionObserver, and displays author attribution. Missing/failed
photos use an honest placeholder, not an unrelated stock image. Photo references,
image URLs and place content are not persisted or shared-cached. Official reference:
https://developers.google.com/maps/documentation/places/web-service/place-photos

The floating `Ăn gì?` button opens a native modal dialog with a lucky wheel. It takes
up to eight eligible choices from the current results, samples with unbiased
`crypto.getRandomValues`, and animates to the selected segment. The default pool uses
only confirmed budget matches. An explicit checkbox allows unpriced restaurants
into the pool; the result retains its unknown-price label. Closed restaurants are
excluded from that optional pool. Search/budget changes invalidate the old pool.
Reduced-motion settings, Escape, focus return and disabled-during-spin states are
handled. Spinning does not record an action; confirming a dish persists CHOSEN with
an idempotency key and removes that dish from current suggestions for four days.

Existing Places credentials in `backend/.env` are reused. Real photos/ratings require
Google Places API (New) and access to Place Photos under the configured project's
billing/quota. Other sources may not supply photos or ratings, which is shown clearly.
Plus Jakarta Sans is self-hosted under `frontend/public/fonts` with its OFL license,
so remote font loading cannot block the application's styling.

Validation: backend build/typecheck/lint; existing unit/integration suite; database
tests for budget, distance, menu freshness, seed exclusion, cooldown, photo auth and
credential handling; desktop/mobile browser tests for finding, spinning, confirmation,
unpriced opt-in, responsive layout and actual CSS styling.
