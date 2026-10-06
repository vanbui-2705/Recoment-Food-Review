# Kế hoạch hoàn thiện Rec-Food

Ngày chốt phạm vi: 06/10/2026. Đã bắt đầu thực hiện P0/P1; nghiệm thu và giới hạn hiện tại ở [bản ghi validation](PLAN_P0_P1_VALIDATION.md). Các mục còn lại tiếp tục là kế hoạch, chưa phải chức năng đã triển khai.

Các thông báo/cảnh báo cho luồng đang có được bổ sung trong [User notifications](USER_NOTIFICATIONS.md): mạng, phiên đăng nhập, lưu dữ liệu, phân tích khẩu vị, vị trí và độ chắc chắn của dữ liệu quán. Việc này không đồng nghĩa các module còn lại hoặc push/email/SMS đã hoàn thành.

## 1. Phạm vi phát hành

Giữ số nhóm của bản rà soát để theo dõi:

| Nhóm | Phạm vi | Đợt | Trạng thái |
|---|---|---|---|
| 1 | AI đọc mô tả khẩu vị | P1 | Đã xây analysis/worker/review/UI; chờ AI key để nghiệm thu live |
| 2 | Thực đơn/giá/ảnh món từ nguồn thật | P2 | Cần adapter và nguồn merchant |
| 3 | Gợi ý cá nhân hóa, tự tải quanh vị trí | P3 | Hoàn thiện phần hiện có |
| 4 | LLM xếp hạng và giải thích | P3 | Cần xây |
| 5 | Chat discovery nhiều lượt/streaming | P4 | Cần xây |
| 6 | Chi tiết quán và menu | P2 | Hoàn thiện phần hiện có |
| 7 | Bằng chứng dị ứng theo quán | P2 | Cần workflow và dữ liệu xác minh |
| 8 | Feedback và quản lý lịch sử | P5 | Hoàn thiện phần hiện có |
| 9 | Giỏ hàng và đơn hàng | Sau bản phát hành này | **Coming soon** |
| 10 | Thanh toán và giao hàng | Sau bản phát hành này | **Coming soon** |
| 11 | Quản trị | P2 nền tảng, P5 đầy đủ | Cần UI và API bổ sung |
| 12 | Tài khoản và vận hành | P0/P6 | Hoàn thiện phần hiện có |

Không xây cart/order/payment/delivery schema, API hay tool AI ở đợt này. Nếu giao diện có các mục này thì hiển thị Coming soon, không tạo cảm giác đã đặt món/thanh toán được. Link chỉ đường và liên hệ quán vẫn hoạt động.

## 2. Nền tảng tiếp tục sử dụng

- Fastify modular monolith, PostgreSQL/Prisma, React/Vite và proxy `/api`.
- Auth/refresh/RBAC; profile cấu trúc; mô tả cá nhân có revision; catalog món và alias.
- Sáu adapter nguồn đã có, tìm quán/công thức, hướng dẫn nấu, ảnh/attribution.
- Nearby budget/radius 3–4 km, GPS, vòng quay và idempotency cho chọn/ăn.
- Quy tắc loại món đủ 96 giờ: lần chọn/ăn mới đặt lại mốc; không tự nới bộ lọc.
- Không giữ Google photo resource/image URL lâu dài hoặc coi ảnh quán là ảnh món.

Mô tả khẩu vị chưa phân tích đang chặn gợi ý cá nhân hóa tự động; tìm kiếm chủ động vẫn dùng được. P1 phải xử lý revision và an toàn trước khi gỡ chặn. Không thay màn hình một ô nhập bằng catalog/slider bắt buộc.

## 3. Thứ tự và điều kiện phụ thuộc

```text
P0: baseline, hợp đồng API/config, Coming soon
 ├─ P1: AI trích xuất khẩu vị
 ├─ P2: merchant menu + bằng chứng an toàn + chi tiết quán + admin ingest
 └─ P6a: tài khoản/email + CI, metrics, backup nền tảng
P1 + P2 -> P3: recommendation thống nhất + LLM
P3 -> P4: chat discovery
P3 + admin ingest -> P5: feedback + admin đầy đủ
P1..P5 + P6a -> P6b: kiểm tra live và phát hành
```

Có thể thực hiện các nhánh độc lập trong từng đợt; P3 không cần đợi hợp đồng merchant để xây/test, nhưng không được ghi đã có gợi ý giá món live khi chưa có dữ liệu thật. Không chặn việc xây phần độc lập vì một provider chưa cấp key.

## 4. P0 — Chốt baseline và hợp đồng

Đầu ra:

- Rà lại CI, phiên bản Node khớp lockfile và Docker; ghi baseline typecheck/lint/unit/DB/browser/build.
- Chốt DTO dùng chung cho restaurant, menu item, source evidence, safety và candidate; ảnh/rating quán khác ảnh/rating món.
- Tách trạng thái `NOT_CONFIGURED`, `UNAVAILABLE`, `NO_MATCH`, `INSUFFICIENT_SAFETY_DATA`, `PROFILE_PENDING_ANALYSIS` và fallback LLM.
- Coming soon cho nhóm 9/10 tại vị trí phù hợp, không mở thêm tab trống chỉ để quảng cáo chức năng.
- Bổ sung cấu hình được validate khi bắt đầu module tương ứng; key chỉ backend, lỗi không lộ key.

Done: baseline được ghi nhận; không có endpoint/tool giao dịch mới; regression discovery và 96 giờ vẫn qua.

## 5. P1 — AI đọc khẩu vị, knowledge base cá nhân

### Backend và dữ liệu

- Thêm `TasteAnalysisJob`: user, sourceRevision, trạng thái QUEUED/RUNNING/NEEDS_REVIEW/APPLIED/FAILED/SUPERSEDED, attempt, lease/expiry, model/schema version, lỗi chuẩn hóa.
- Thêm kết quả trích xuất có mã catalog và trích đoạn nguồn; không lưu chain-of-thought. Unique user + revision + schemaVersion; retry không tạo job trùng.
- Lưu mô tả -> enqueue job transactionally. Worker PostgreSQL claim/lease, retry tối đa 3 lần với backoff, phục hồi job bị bỏ dở. Chưa cần Redis.
- LLM chỉ trích xuất thông tin được nói rõ: thích/ghét, vị, diet/allergy, budget, meal/area. Unknown giữ unknown; không đoán tọa độ từ khu vực tự do.
- Áp dụng sở thích mềm đã validate tự động nếu revision còn khớp. Dị ứng/diet chưa rõ hoặc thay đổi an toàn chuyển NEEDS_REVIEW; chỉ xác nhận mới áp dụng ràng buộc đó. Không tự xóa dị ứng cũ khi người dùng không nhắc lại.
- Áp dụng hồ sơ và `analyzedRevision` trong cùng transaction với kiểm tra revision; kết quả revision cũ thành SUPERSEDED. Không đánh dấu analyzed khi còn câu hỏi an toàn.

### API và UX

- Giữ GET/PUT `/users/me/food-knowledge`; thêm trạng thái analysis.
- `POST /users/me/food-knowledge/analyses`: chạy/retry revision hiện tại, idempotent.
- `GET /users/me/food-knowledge/analyses/:id`: owner-only, trạng thái và bản trích xuất có thể đọc.
- `POST /users/me/food-knowledge/analyses/:id/confirm`: xác nhận/sửa mã đã validate, sourceRevision bắt buộc.
- Ô nhập và nút lưu như hiện tại; phía dưới hiển thị đang phân tích/kết quả/cần làm rõ/thử lại. Review chỉ xuất hiện khi cần, không ép người dùng khai báo catalog ngay từ đầu.

Test/Done: ownership, revision race, retry/restart, JSON sai, unknown code, mâu thuẫn dị ứng, provider timeout/key thiếu; sửa mô tả giữa lúc job chạy không bị ghi đè; lưu -> phân tích -> recommendation có E2E. Thiếu key báo chưa cấu hình và giữ tìm kiếm chủ động.

## 6. P2 — Thực đơn thật, safety và chi tiết quán

### Nhóm 2: nguồn thực đơn

- Định nghĩa supplier contract `searchRestaurants`, `fetchMenu`, `fetchMenuEvidence`; một HTTP adapter chỉ triển khai live theo tài liệu/hợp đồng của supplier được chọn.
- Trước adapter live phải có quyền dùng dữ liệu, auth, payload mẫu, currency, menu availability, freshness, pagination và rate limit. Không đặt tên một API giả rồi coi đã tích hợp.
- Thêm `ExternalRestaurantIdentity` unique(provider, externalId), `ExternalMenuItem` unique(provider, merchantId, externalItemId), `MenuSyncJob`, `MenuImportRun` và error/quarantine records.
- Menu item lưu tên gốc, canonicalDishId nullable, VND price, currency, availability, observedAt/expiresAt, source URL, merchant identity và ảnh/attribution nếu nguồn cho phép. Quán có nhiều size/topping không ép vào một `RestaurantDish`; dùng offer identity riêng.
- Mapping tên/alias rõ ràng tự động; tên chưa biết hoặc nhiều nghĩa vào hàng chờ review. Không gán thành phần/giá từ AI thành merchant evidence.
- Upsert idempotent, xử lý page đầy đủ, đồng bộ delta/full snapshot; chỉ đánh dấu món biến mất khi full sync thành công. Sync lỗi không làm toàn bộ quán hết món; món quá hạn mất nhãn giá xác nhận.
- Freshness mặc định 24 giờ cho menu nếu hợp đồng không ngắn hơn; upstream TTL ngắn hơn được ưu tiên. Không đổi giá currency khác sang VND im lặng.
- Job định kỳ/check thủ công có timeout, retry giới hạn và lease; quota là trạng thái có thể quan sát. Ingest phải hỗ trợ dry-run và không lấy development seed làm evidence.

### Nhóm 7: bằng chứng an toàn

- Thêm `MenuSafetyEvidence` theo offer/quán/allergen hoặc diet, presence UNKNOWN/PRESENT/ABSENT, evidence source, người rà soát, thời điểm/thời hạn và cross-contact status.
- Thiếu mapping không có nghĩa không chứa dị nguyên. Dữ liệu mâu thuẫn/quá hạn/không biết nhiễm chéo không được gợi ý như món an toàn.
- Recommendation tự động chạy hard filter bằng backend trước ranking/LLM. Discovery chủ động vẫn hiển thị thông tin nhưng giữ cảnh báo và không có nhãn an toàn khi thiếu evidence.
- Admin duyệt bằng chứng dựa trên tài liệu thật từ quán/supplier; lưu lịch sử thay đổi và lý do. Không hứa giải quyết thiếu dữ liệu chỉ bằng code.

### Nhóm 6: trang chi tiết quán

- `GET /restaurants/:id`: identity, địa chỉ, khoảng cách, giờ, contact, Maps link, nguồn, updatedAt; chỉ gọi allowlisted provider IDs.
- `GET /restaurants/:id/menu`: menu phân trang, giá/availability/safety/ảnh với freshness; tách rõ kết quả từ khóa chưa xác nhận menu.
- Giữ `/places/photo`; mở rộng ảnh món chỉ cho nguồn hợp lệ, URL an toàn và attribution.
- Trang quán: thông tin đầu trang, ảnh có nguồn, menu, lọc ngân sách, chi tiết món, đường đi/liên hệ; không có nút mua đang hoạt động.
- Source lỗi hoặc quán chưa map được có thông báo rõ và link Maps; không dựng menu giả.

### Admin ingest nền tảng

- API ADMIN dry-run/commit import được phép, xem sync run, retry, review mapping và safety evidence.
- Import là công cụ vận hành/bổ sung nguồn; người dùng không nhập món thủ công để dùng app.

Test/Done: identity collision, nhiều offer một món, nhập lại, giá thay đổi, currency, pagination, partial failure, TTL, revoked/expired evidence, radius/antimeridian, authorization. Có E2E món thật đủ ngân sách -> chi tiết quán; integration live cần supplier/key và bộ dữ liệu được phép.

## 7. P3 — Recommendation thống nhất và LLM

### Nhóm 3: recommendation

- `POST /recommendations`: context budget/location/radius/meal, idempotency và profile revision; `GET /recommendations/:id` owner-only. Giữ `/recommendations/today` tương thích trong quá trình chuyển frontend.
- Ghép profile đã xử lý + menu fresh + live place metadata + lịch sử/dislikes. Hard filter: safety/diet, budget thực, radius thực, availability/opening và cooldown đủ 96 giờ.
- Tách strict verified candidates khỏi unpriced venues và cooking ideas; không đưa quán chưa có giá vào danh sách khẳng định đúng ngân sách.
- Config trọng số bounded cho taste/cuisine, khoảng cách, budget, rating và novelty; deterministic tie-break và đa dạng hóa món/quán; score normalize 0–100 để khớp schema DB hiện có.
- Persist request/result snapshot và score breakdown nội bộ, lý do hiển thị, sources/freshness; không lưu content Google ngoài chính sách được phép.
- Identity cooldown xuyên nguồn qua canonical dish/alias chắc chắn; trường hợp chưa rõ không tự gộp món khác nhau.

### Nhóm 4: LLM

- Provider interface: analysis, rerank, chat; gọi qua backend, deadline/cost/token cap cấu hình riêng.
- Gửi top 20 candidates đã qua filter; output chỉ candidate IDs có sẵn, thứ hạng và giải thích có căn cứ. Validate schema, unique IDs, không thêm giá/quán/safety claims mới.
- LLM không sửa ràng buộc và không có quyền xác minh dị ứng. Timeout/JSON sai/ID bịa -> ranking deterministic, reason chuẩn và fallback flag; không làm mất kết quả hợp lệ.

### UX và vòng quay

- Vào app tự tải gợi ý bằng budget/radius đã lưu và vị trí hợp lệ; vị trí chưa có thì hiển thị lời mời bật GPS, không lặp popup tự động. Ngân sách nhập ở trang chính ghi nhớ theo tài khoản.
- Khi đổi vị trí/budget/profile cập nhật generation, bỏ response cũ; debounce request và không gọi mọi provider theo mỗi ký tự nhập.
- Vòng quay dùng pool hiện tại đã lọc; quán unknown price cần opt-in như hiện tại. Quay không ghi lịch sử; xác nhận mới ghi CHOSEN và loại món trong 96 giờ.
- Empty/pending/no-safe-match/provider-error có hướng xử lý; không tự nới ngân sách hoặc thời gian chờ.

Test/Done: ràng buộc kết hợp, đúng biên 96h, duplicate identity, stable ranking, no candidate, invalid LLM/injection/timeout, revision stale, request ownership và self-load trên desktop/mobile. Kết quả phải dùng giá offer thật; fallback không ngụy tạo dữ liệu.

## 8. P4 — Chat khám phá món ăn

- Thêm `Conversation`, `ChatMessage`, `ChatRun` có owner, context có version, trạng thái và idempotency. Tách thông tin user hiển thị khỏi tool trace đã lọc; không lưu secret prompt/chain-of-thought.
- API: POST/GET `/conversations`, GET/DELETE `/conversations/:id`, GET `/conversations/:id/messages`, POST `/conversations/:id/messages`, GET `/chat-runs/:id/events`.
- Streaming SSE dùng fetch + bearer headers, không đưa token vào URL. Event seq, reconnect theo cursor, cancel/abort, một run hoạt động trên conversation và xử lý gửi lại khi mạng đứt.
- Tools allowlist: profile, search dishes/recipes/restaurants, restaurant details, recommendation. User identity do backend inject, không nhận userId từ model; giới hạn tối đa 5 tool calls/run và deadline tổng.
- Chat nhớ context có cấu trúc và hỏi lại budget/location khi thiếu; area text không được biến thành tọa độ đoán. Ghi profile từ chat phải đi qua review/revision của P1.
- UI chat lịch sử, gửi/hủy/thử lại, thẻ món/quán bấm được và thông báo khi AI không cấu hình. Công thức vẫn truy xuất từ provider, không bịa bước nấu rồi gắn nhãn nguồn.
- Khi hỏi đặt món/thanh toán/giao hàng: trả Coming soon và hỗ trợ xem quán/chỉ đường. Không expose tool create_cart/submit_order/pay.

Test/Done: ownership, prompt injection, tool authorization, invented IDs, max-tool limit, chat nhiều lượt, SSE disconnect/reconnect, double submit, cancel và Coming soon không tạo giao dịch.

## 9. P5 — Feedback và admin đầy đủ

### Nhóm 8: feedback

- `POST /recommendations/:id/feedback`: VIEWED/SKIPPED/LIKED/DISLIKED/CHOSEN/EATEN/RATED đúng schema, rating integer 1–5 chỉ cho RATED, idempotency và liên kết result/offer hợp lệ thuộc user.
- Giữ endpoint CHOSEN/EATEN và preference cũ; thêm feedback cho external offer/recipe mà không phải tự nhập catalog.
- `POST /data-reports`: report price/menu/location/photo/safety sai, tham chiếu source và timestamp; chống spam, trạng thái xử lý.
- History cursor pagination, lọc loại/ngày và xóa event/chọn khoảng thời gian; xóa hành vi ảnh hưởng cooldown phải có preview rõ, preference được quản lý riêng.
- Người dùng chấm điểm trải nghiệm trên app khác rating Google; không cộng hai nguồn thành một điểm giả. Report safety chưa được duyệt không tự thành evidence an toàn.
- Ranking chỉ học sở thích mềm; feedback không sửa allergy/diet bắt buộc.

### Nhóm 11: admin

- Layout ADMIN có điều hướng users/content/restaurants/menu/sync/evidence/reports/audit; mọi API kiểm tra role backend.
- Hoàn thiện CRUD/catalog, soft deactivate thay xóa phá lịch sử, duyệt mapping và sources, review bằng chứng, xử lý report có lý do.
- User list/filter, khóa/mở khóa và revoke sessions; bảo vệ không tự khóa/xóa ADMIN cuối cùng.
- `AdminAuditLog`: actor/action/target/reason/time và diff đã redact; ghi transactionally, không cho sửa log bằng API thường. Không log khẩu vị/vị trí/token đầy đủ.
- Admin xem provider health/quota mà không thấy giá trị key; retry sync phải rate-limit và idempotent.

Test/Done: USER gọi ADMIN bị 403, disabled user không dùng access/refresh, audit rollback, last-admin protection, deactivate giữ history, report lifecycle và feedback không sửa ràng buộc an toàn.

## 10. P6 — Tài khoản và vận hành production

### Nhóm 12: self-service

- UI đổi mật khẩu dùng API đã có; quản lý tên tài khoản và session/logout-all.
- POST `/auth/forgot-password`, POST `/auth/reset-password`, POST `/auth/email-verification`, POST `/auth/verify-email`; token ngẫu nhiên hash-at-rest, single-use, expiry, resend cooldown; forgot-password trả cùng thông điệp cho email tồn tại/không tồn tại.
- Provider email qua adapter và outbox retry; token reset không vào application logs, URL frontend theo origin allowlist. Reset đổi password + revoke sessions trong transaction.
- Account export owner-only với recent authentication; xóa tài khoản theo xác nhận rõ và re-auth, revoke sessions rồi cleanup job. Không đưa dữ liệu nhà cung cấp bị hạn chế quyền vào export.
- Privacy settings/retention: mặc định chat 90 ngày, recommendation snapshot 90 ngày, hành vi 180 ngày, export artifact tối đa 24 giờ; cooldown 96 giờ nằm trong retention. Audit vận hành 365 ngày với định danh được ẩn danh khi xóa account; chạy cleanup có test. Chốt chính sách hiển thị trong trang privacy trước release.

### Vận hành

- CI backend/frontend: migration database mới, generate, lint/typecheck/unit/DB, frontend build, Playwright desktop/mobile và Docker image. Pin toolchain tương thích; provider fake trong CI, live smoke tách riêng và không lộ key.
- Health liveness/readiness có DB dependency; request ID, structured/redacted logs, metrics latency/error/no-match/LLM fallback/provider quota/job backlog/cost.
- Shared rate-limit/quota backend khi nhiều replica; không coi limiter process-local hiện có là quota toàn cluster. Chọn PostgreSQL atomic counters ban đầu, benchmark contention; Redis chỉ khi cần.
- Migration job riêng; secrets qua environment/secret store; TLS, CORS allowlist, body limits, timeouts; không lưu vị trí/token trong logs.
- Docker/non-root, worker tách web process, graceful shutdown/lease recovery; staging deploy và runbook release/rollback.
- Backup PostgreSQL và restore drill: mục tiêu ban đầu RPO <=24h/RTO <=4h; production phải đo thực tế và chọn PITR nếu cần RPO thấp hơn. Restore sang môi trường cô lập rồi kiểm tra ownership/history.
- Dashboard/cảnh báo: lỗi API/provider, worker kẹt, DB down, tăng fallback và quota/cost; chỉ đặt ngưỡng cuối sau load test.

Test/Done: reset/verify replay/expiry/enumeration, logout-all, export/delete ownership, cleanup, restore drill, dependency readiness, no secrets/log PII, load test và rollback rehearsal. Chưa deploy tài khoản cloud thật khi thiếu môi trường/credentials; report riêng code-ready và live-ready.

## 11. Cấu hình cần bổ sung khi triển khai

| Nhóm | Biến runtime | Ghi chú |
|---|---|---|
| LLM | `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_TIMEOUT_MS`, `LLM_MAX_TOKENS`, `LLM_DAILY_REQUEST_LIMIT`, `LLM_DAILY_BUDGET_USD`, `LLM_INPUT_USD_PER_MILLION`, `LLM_OUTPUT_USD_PER_MILLION`, `LLM_PRICING_VALID_UNTIL`, `LLM_INPUT_MAX_BYTES` | Gemini adapter; quota và budget dùng chung PostgreSQL; giá cấu hình phải được operator xác minh trước live |
| Merchant | `MENU_SYNC_WORKER_ENABLED` | Registry live hiện trống, cần hợp đồng trước adapter. Lịch/freshness lưu theo supplier trong DB; chưa có biến API key merchant để cấu hình một provider chưa được chọn |
| Jobs | `WORKER_ENABLED`, `JOB_MAX_ATTEMPTS`, `JOB_LEASE_SECONDS`, `CHAT_RUN_TIMEOUT_MS` | Worker tách web; menu jobs có lease/retry riêng theo contract đã kiểm thử |
| Email | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_APP_URL`, `EMAIL_ALLOWED_ORIGINS`, `EMAIL_OUTBOX_ENCRYPTION_KEY`, `EMAIL_TIMEOUT_MS` | Resend outbox; thiếu cấu hình không báo đã gửi; domain gửi cần xác minh |
| Vận hành | `SECURITY_NAMESPACE`, `TRUST_PROXY_IPS`, `PROVIDER_REQUESTS_PER_MINUTE` | Metrics yêu cầu ADMIN; retention là defaults có kiểm thử, không có runtime `RETENTION_*`/`METRICS_ENABLED` |

Sáu provider key hiện có được giữ nguyên. Tên biến và defaults chính thức nằm trong [backend/.env.example](../backend/.env.example), staging wiring trong [deploy/staging.env.example](../deploy/staging.env.example). Không đưa key vào Vite hoặc git. Các tên biến dự kiến trong bản kế hoạch ban đầu đã được thay bằng cấu hình thực tế ở bảng trên; xem [runbook](RELEASE_RUNBOOK.md) để bật từng nguồn và nghiệm thu live.

## 12. Cách chia PR và nghiệm thu

Mỗi đợt chia PR nhỏ theo thứ tự: schema/migration -> service/adapter + tests -> API/authorization -> UI/E2E -> docs/operation. Migration expand trước, giữ API cũ cho đến khi frontend chuyển xong; không drop dữ liệu để rollback.

Checklist thực hiện nằm trong [tasks OpenSpec](../openspec/changes/complete-food-discovery-platform/tasks.md). Mỗi nhóm có hai mức:

- **Code-ready:** migration, service, API, UX, tests và cấu hình đã xong; provider fake chỉ xác nhận hành vi.
- **Live-ready:** credentials hợp lệ, dữ liệu được phép, nguồn thật kiểm tra thành công, quota/chi phí và runbook đạt yêu cầu.

Release gates: toàn bộ regression hiện có qua; hard filter/cooldown không bị bypass bởi AI/wheel; các nguồn giá/ảnh/rating ghi rõ; P1 race không ghi đè; chat không có tool giao dịch; admin/account ownership và secrets qua test; backup restore + rollback thành công; Coming soon không tạo order/payment.

Đợt thực hiện đầu tiên: P0 và P1. Sau đó triển khai P2 hạ tầng ingest/evidence cùng tài khoản/vận hành độc lập; chờ supplier chỉ ảnh hưởng live menu, không dừng các module còn lại.
