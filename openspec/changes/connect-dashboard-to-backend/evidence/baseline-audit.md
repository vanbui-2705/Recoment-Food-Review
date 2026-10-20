# Dashboard integration baseline

Captured before implementation on 2026-10-11 against `http://127.0.0.1:8081`.

## Runtime identity

- Frontend container: `14825b00a06ef0f2a883afdfe8878a010509956d849c8a4f5b78e273cd610bf0`
- Frontend image: `sha256:87ce1b6c6bfbc7d29c2b480531ae6df5c56809bdb7a90b992165aafda68e53c9`
- Published port: host `8081` to container `80`
- Routes: `#today`, `#chat`, `#map`, `#profile`, `#history`
- The pre-existing working tree was clean; only this OpenSpec change was untracked when capture began.

## Protected source hashes

| File | SHA-256 |
|---|---|
| `frontend/src/main.jsx` | `3374F61D9E1482FBC4A32AE9377B266E6A5055538D7F3463264562F35C8E37D6` |
| `frontend/src/profileApi.js` | `4D5DCA8CD976DEAD48E2172F34B905F3708BE96EF0AED17EDD8D6FFB0FEF392F` |
| `frontend/src/features/dashboard/EatwiseDashboard.jsx` | `3DE8EDECBEB79505451737CB2DBFFE7B159C1B6CA16B8334B95763CEFCCD8CE9` |
| `frontend/src/pages/ChatPage.jsx` | `552028512F719AB50290A426A3937C9AEA8577E3EB066D143C77CB1ABE53ACCA` |
| `frontend/src/pages/DiscoveryPage.jsx` | `CC1B798934F495A060D0B09BB56B2561A88138669592F0DF5CC5D29F88380CE4` |
| `frontend/src/pages/HistoryPage.jsx` | `75E76BA00AC791503AF1A83DB8D0D346FFC89C56B1C081EF0B183352ECA260E2` |
| `frontend/src/pages/MapPage.jsx` | `6FD5DE21BA2390DA09A2CC52CA454EA4F07B84A90C4F4B7655E955634612D679` |
| `frontend/src/pages/ProfilePage.jsx` | `B3197CA34486772271C26AF408336D712A706B6215B5118862361EEE169023FB` |

## Layout baseline

Ten screenshots are stored in `evidence/baseline/`, one desktop (1280×900) and one mobile (390×844) for each route. Every capture had `scrollWidth === innerWidth`, a visible navigation, and a non-zero main region.

| Viewport | Main region |
|---|---|
| Desktop | x=232, y=64, width=1048, height=836 |
| Mobile | x=0, y=64, width=390, height=780 |

## Control-to-API audit

| Visible behavior | Contract | Classification | Safe action |
|---|---|---|---|
| Header account | `GET /users/me` | Supported | Replace identity fallback with response data inside existing elements |
| Logout | `POST /auth/logout` | Supported | Keep current button and connect/test cleanup |
| Profile allergy/radius fields | `GET/PUT /users/me/profile` | Partial | Map supported fields only; preserve markup |
| Profile chef notes | None | Unsupported | Do not map to a different field; approval required |
| Today recommendations | `GET /recommendations/today`, `POST /recommendations` | Supported/partial | Replace card data where semantics match |
| Discovery interactions | Dish/recipe interaction and recommendation feedback endpoints | Supported | Connect existing actions with idempotency |
| Map/nearby list | `GET /discovery/nearby-food`, `GET /discovery/restaurants` | Supported/partial | Use saved profile coordinates; no permission prompt |
| Chat conversation and send | Conversation/message/chat-run endpoints | Supported | Connect existing input and message region |
| Chat live dispatcher/order | None | Unsupported | Leave untouched; approval required |
| History order/delivery cards | `GET /users/me/history` returns interactions, not orders | Incompatible | Do not mislabel interactions as orders; approval required |
| Re-order/payment/delivery | None | Unsupported | Do not fake-connect to chat; approval required |
| Browser location | Browser API plus discovery endpoints | Visible permission impact | Approval required before prompting |
| Login/register/recovery | Auth endpoints exist but no current screen | UI missing | Approval required before adding UI/navigation |

## Automatic implementation boundary

Implementation may add API clients, adapters, state and callbacks while preserving markup, class names, labels and navigation. Any new visible state, changed screenshot outside dynamic content, backend/schema edit, permission prompt or semantic reinterpretation stops at an approval gate.

## First completed slice: account/profile

- The existing header and profile identity elements now consume `GET /users/me`.
- Existing allergy toggles now consume `GET /users/me/profile`.
- The existing save button now performs one `PUT /users/me/profile`, preserves unsupported/unknown profile fields, rejects duplicate clicks, and reports success only after HTTP 200.
- Session refresh is single-flight and retries the original read; validation and service failures use the existing dashboard notice region.
- Build passed; profile success, validation, service-failure, refresh, and duplicate-click tests passed.
- All five layout routes passed desktop and mobile overflow/navigation assertions after the change.
- Docker smoke through port 8081 returned register 201, login 200, profile save 200, no horizontal overflow, and test-account cleanup 202.
- Previous image retained as `rec-food-frontend:pre-dashboard-api-20261011`; deployed image id is `sha256:6f91df11c2cb639eddc7f62a3e3a3117682516a15a8658eb89b31f83b0b98c1b`.
