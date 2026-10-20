## 1. Freeze and audit the current frontend

- [x] 1.1 Record the existing git status, Docker image/container metadata, source file hashes and route inventory without modifying or restoring user changes.
- [x] 1.2 Capture deterministic desktop (1280×900) and mobile (390×844) baselines for `#today`, `#chat`, `#map`, `#profile` and `#history` using the current redesign.
- [x] 1.3 Add layout assertions for horizontal overflow, visible navigation, unobscured main content and the position/size of primary controls on all five routes.
- [x] 1.4 Audit every interactive control against an existing backend endpoint and publish a redacted matrix of supported, partial, incompatible and unsupported controls before implementation.
- [x] 1.5 Present the protected baseline and audit summary to the user; proceed automatically only for items proven to preserve markup, styling, labels, navigation and baseline layout.

## 2. Establish the non-visual integration boundary

- [x] 2.1 Add contract fixtures/tests for users, profile/catalogs, recommendations, discovery/nearby, chat/SSE and history based on the current backend schemas.
- [x] 2.2 Extract or extend the shared API client while preserving existing token keys, single-flight refresh, one retry, error normalization and `/api` Nginx routing.
- [x] 2.3 Add domain adapters that convert backend payloads into the current card/profile/message view-models and reject semantically incompatible data instead of inventing fields.
- [x] 2.4 Add tests for nullable/missing fields, maximum-length content, idempotency-key reuse on retry and duplicate-submit prevention.
- [x] 2.5 Run frontend build/tests and verify the five deterministic visual baselines are unchanged before wiring any page.

## 3. Connect session, account header and compatible profile fields

- [x] 3.1 Verify the current `GET /users/me`, `GET /users/me/profile` and logout calls against live Docker endpoints using a dedicated test account with secrets redacted.
- [x] 3.2 Populate the existing header fields from the authenticated user response without changing header markup, classes, labels or layout.
- [x] 3.3 Load and map only compatible profile fields such as allergies, budget/radius and supported preferences into the existing controls.
- [x] 3.4 Replace the profile save timeout with one real `PUT /users/me/profile` request that preserves backend fields not editable in this UI and reports success only after confirmation.
- [x] 3.5 Add success, validation failure, network failure, refresh and double-click tests; confirm no false-success notification is shown.
- [x] 3.6 Run desktop/mobile visual comparison and Docker smoke tests for header/profile; stop and create an approval packet if any fixed presentation changes.

## 4. Connect discovery and recommendation behavior

- [x] 4.1 Load current recommendations and recipes through `GET /recommendations/today` and `GET /recipes/today`, mapping only semantically compatible items into existing card slots.
- [x] 4.2 Connect refresh/search intent to the existing recommendation/discovery endpoints without adding controls or changing navigation.
- [x] 4.3 Connect compatible like/chosen/eaten actions to their interaction or feedback endpoints with stable idempotency keys and disabled duplicate submission in logic.
- [x] 4.4 Remove runtime fixture fallback for completed discovery paths and verify provider-unavailable/no-match/error responses are not presented as real recommendations.
- [x] 4.5 Add functional tests proving API requests and mutation payloads, then run visual/overflow checks on desktop and mobile.
- [x] 4.6 If empty/error/provider states cannot be represented in an existing region without presentation changes, prepare the approval packet and leave only those states blocked.

## 5. Connect nearby food and map data

- [x] 5.1 Derive budget, radius and available coordinates from the live profile/discovery settings without triggering a browser permission prompt.
- [x] 5.2 Load `GET /discovery/nearby-food` or compatible restaurant search results and map them to the existing place list and selected-place panel without fabricating menu, rating, distance or open status.
- [x] 5.3 Connect existing category selection to supported search/filter inputs only where the semantics match; document unsupported categories rather than silently remapping them.
- [x] 5.4 Add tests for missing coordinates, partial providers, nullable place fields, selection behavior and request limits.
- [x] 5.5 Run desktop/mobile visual comparison and Docker smoke tests; move geolocation permission or new missing-location UI to an approval gate.

## 6. Connect compatible chat behavior

- [x] 6.1 Load/create a conversation with the existing conversations endpoints and map live messages into the current chat presentation.
- [x] 6.2 Connect the existing send button to one idempotent `POST /conversations/:id/messages` request and retain the input on failure.
- [x] 6.3 Consume chat-run SSE events, resume from the last sequence without resubmitting and update only existing message/result regions.
- [x] 6.4 Add tests for send success/failure, duplicate click, reconnect semantics, unconfigured AI and interrupted stream.
- [x] 6.5 Run visual/overflow comparisons and Docker smoke tests; do not mark the live order dispatcher as connected.
- [x] 6.6 If reconnect, cancel, AI-unavailable or error handling requires new visible controls, prepare an approval packet and stop those subpaths before UI edits.

## 7. Mandatory approval gates for incompatible or visible changes

- [ ] 7.1 **APPROVAL REQUIRED:** Present options and before/after mockups for login/register/recovery/session-expired UI; do not add a page, modal or redirect without explicit user approval.
- [ ] 7.2 **APPROVAL REQUIRED:** Present the mismatch between backend interaction history and the current order/delivery/payment/driver history UI; ask whether to redesign that page or create a separate backend order scope.
- [ ] 7.3 **APPROVAL REQUIRED:** Present options for profile “chef notes” that have no backend field; do not overload allergies/preferences with different semantics.
- [ ] 7.4 **APPROVAL REQUIRED:** Present options for order, reorder, payment, delivery and live dispatcher controls that have no backend domain; do not fake-connect them to chat.
- [ ] 7.5 **APPROVAL REQUIRED:** Present any required loading, empty, error, provider-unavailable, missing-image or missing-location UI with screenshots and exact file/class impact before editing presentation.
- [x] 7.6 **APPROVAL REQUIRED:** Present browser geolocation behavior and privacy impact before triggering a location permission prompt.
- [ ] 7.7 **APPROVAL REQUIRED:** If any frontend integration requires a backend route/schema/database change, create a separate delta proposal and obtain approval before modifying backend code.

## 8. End-to-end verification and controlled rollout

- [ ] 8.1 Run frontend build, relevant Playwright suites and backend contract/integration tests with no new console or network errors.
- [x] 8.2 Rebuild only the frontend Docker image for approved completed slices, retain the previous image reference and verify `/api` proxy behavior through port 8081.
- [ ] 8.3 Execute an authenticated smoke matrix for profile save, recommendation load/interaction, nearby places and chat send/stream; redact tokens and personal data from artifacts.
- [ ] 8.4 Compare all five desktop/mobile routes with the protected baseline and confirm all differences are limited to approved dynamic data regions.
- [ ] 8.5 Report completed, blocked and approval-required functions separately; do not claim the frontend is fully functional while any mock or unsupported control remains.
- [ ] 8.6 Document per-slice rollback instructions and verify the previous frontend image can be restored without database changes.

## 9. Complete authentication and session workflows

- [ ] 9.1 Audit register, login, email verification, forgot/reset password, refresh, logout and session-management contracts end to end.
- [x] 9.2 Prepare and obtain approval for auth routes/screens and the session-expired transition before changing visible frontend structure.
- [ ] 9.3 Implement the approved auth/session presentation using the shared API client with no credential or token leakage.
- [ ] 9.4 Add browser tests for every auth success, validation, expiry, refresh and recovery path, then run visual regression.

## 10. Complete profile and account management

- [ ] 10.1 Connect profile catalogs and taste-analysis data that map to the approved profile presentation.
- [ ] 10.2 Audit password, email, active-session, export-data and delete-account endpoints and adapters.
- [ ] 10.3 Prepare and obtain approval for any new visible account controls before adding them.
- [ ] 10.4 Implement approved account actions with confirmation, failure recovery and destructive-action safeguards.
- [ ] 10.5 Add contract, functional and visual tests for the completed profile/account workflows.

## 11. Rebuild History around real interaction data

- [x] 11.1 Document the exact field and action mismatch between the current order-history cards and backend interaction history.
- [ ] 11.2 Prepare and obtain approval for a History presentation covering viewed, chosen and eaten items, feedback, reports and deletion.
- [x] 11.3 Replace order fixtures with the approved interaction-history implementation and real mutations.
- [x] 11.4 Add pagination, empty/error handling and tests without presenting interaction records as orders.
- [x] 11.5 Run desktop/mobile visual comparison and authenticated Docker smoke tests.

## 12. Define the missing commerce backend as a separate approved change

- [ ] 12.1 Specify order/cart lifecycle, payment boundaries, delivery states, reorder and dispatcher behavior without reusing chat/history contracts.
- [ ] 12.2 Present the backend schema, API surface, security implications and required frontend changes for approval.
- [ ] 12.3 Create a separate OpenSpec change for the approved commerce scope; do not implement it implicitly in this integration change.

## 13. Final product acceptance

- [ ] 13.1 Inventory every visible control and prove it is live, intentionally disabled with approved copy, or assigned to the approved commerce change.
- [ ] 13.2 Run the full authenticated E2E, contract, visual and Docker smoke suite across all routes.
- [ ] 13.3 Publish the final completion matrix and rollback references with no mock function reported as production-ready.
