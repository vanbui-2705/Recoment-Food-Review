# Personal food knowledge: free-text taste input

The `Khẩu vị của tôi` screen now contains one text area and a save button.
Users describe preferences, dislikes, allergies, dietary requirements, budget or
area in their own words. It does not load catalog checklists, sliders or structured
onboarding fields. The restaurant search screen still supports current-location GPS.

`GET /users/me/food-knowledge` returns `{ data: { knowledge: null | ... } }`.
`PUT /users/me/food-knowledge` accepts:

```json
{
  "description": "Tôi thích phở, ít cay. Dị ứng đậu phộng.",
  "expectedRevision": 0
}
```

The first write uses revision `0`; edits send the revision from the last GET/write
response. The description is trimmed, must contain non-whitespace text, and has a
6,000-character limit. The authenticated account owns the record; the API does not
accept a user ID. Responses contain description, revision, updatedAt and analysisStatus.
Writes are rate-limited and responses are private/no-store.

Migration `20261006110000_personal_food_knowledge` adds a user-linked table with
description, revision, analyzedRevision and timestamps. Existing structured taste
profiles, allergy/dietary constraints and dish preferences are not overwritten.
Optimistic revision checks prevent lost updates between tabs/devices. An immediate
lost-response retry of identical content can return the already-saved revision.
The UI retains a conflicting draft and offers an explicit reload of saved content.

AI extraction is **not implemented yet**. New/changed descriptions return
`NOT_ANALYZED`. Both automatic dish and cooking recommendations return
`PROFILE_PENDING_ANALYSIS` while the latest description remains unprocessed;
explicit dish, restaurant and recipe searches continue to work. This prevents a
new allergy description from being ignored in favor of stale structured constraints.

The future extractor should read the raw text with its revision, produce validated
structured knowledge, and atomically write the structured profile plus analyzedRevision
only if the source revision still matches. Allergens/diets must use validated catalog
codes; ambiguous safety constraints need resolution rather than guessed absence.
Never mark a newer revision analyzed using an older extraction result. No AI job,
model request, API credential or artificial analysis result is introduced here.

Apply the migration and generate Prisma Client before starting the updated backend.
The frontend persists through the authenticated backend; it does not store the
description as account data in localStorage. Database tests cover isolation,
validation, persistence, conflicts/retries and pending-analysis behavior. Browser
tests cover the single input, save/reload, conflict retention and responsive layout.
