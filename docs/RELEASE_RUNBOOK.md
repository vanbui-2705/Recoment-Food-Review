# Release runbook — Rec-Food

Checkpoint 07/10/2026: **78/86 tasks đã nghiệm thu**. Đây là bản code-ready đã kiểm thử trên dữ liệu tổng hợp và provider fixtures. Chưa có nghiệm thu nguồn merchant thật, AI/email thật hoặc deployment staging công khai. Checklist chính thức: [tasks](../openspec/changes/complete-food-discovery-platform/tasks.md).

## Chức năng hiện có

- Frontend nối backend qua `/api`: nhập mô tả khẩu vị, phân tích/review hồ sơ, tìm quán theo món/vị trí, gợi ý hôm nay theo ngân sách/bán kính, vòng quay, công thức, chi tiết quán/menu.
- CHOSEN/EATEN loại canonical dish trong đủ 96 giờ; vòng quay lấy pool hợp lệ và chỉ xác nhận mới ghi lịch sử. Bộ lọc safety/diet/budget/freshness chạy trước ranking. Thiếu dữ liệu không tự nới điều kiện.
- AI dùng jobs/leases/retry, revision CAS và review dị ứng/diet. Ranking có fallback deterministic. Chat có owner isolation, lịch sử, SSE/cancel, idempotency và allowlist tối đa năm tool calls; không tạo giao dịch.
- Feedback/rating/report, lịch sử có cursor và preview xóa; admin content/catalog/quán/offer, mapping/evidence, khóa tài khoản/revoke sessions, report triage và audit transaction.
- Menu ingest dry-run/commit, paginated snapshot/delta, quarantine, source identities, moderation độc lập với availability, schedule jobs với fencing/lease/retry. Adapter supplier live chưa đăng ký.
- Tài khoản/thiết bị/logout-all, email verify/reset qua outbox mã hóa, export/delete có re-auth, retention và cleanup. Thông báo xác nhận theo kết quả backend; lỗi giữ input và không báo thành công giả.
- Shared quotas/AI budget PostgreSQL, readiness có DB, metrics ADMIN, web-worker-migration riêng, Docker/TLS wiring, backup/restore/rollback/load drills và dashboard/alert files.

Ảnh/đánh giá Google Places là dữ liệu của quán; không gắn nhãn ảnh món hoặc lấy mức giá quán làm giá món. Google Places và các nguồn địa điểm không chứng minh một quán đang bán món cụ thể. Strict recommendations cần offer có giá/currency/freshness/availability phù hợp và safety evidence khi hồ sơ yêu cầu. Công thức có nguồn riêng. Quán chưa có menu/giá được hiển thị với cảnh báo và opt-in phù hợp, không được đưa vào danh sách khẳng định đúng ngân sách.

Product sections 9/10 — cart/order/payment/delivery — giữ **Coming soon**. OpenSpec task groups 9/10 — feedback/admin — đã triển khai.

## Tám điều kiện còn thiếu

| Task | Phần code đã có | Đầu vào/kiểm tra còn cần |
|---|---|---|
| 2.10 | AI analysis adapter, jobs, review, UI | Key/model được phép; smoke thật và ghi readiness |
| 3.1 | Supplier schema/DTO và ingest contract nội bộ | Tên supplier, tài liệu chính thức, quyền dùng dữ liệu, semantics snapshot/delta và giá |
| 3.8 | Registry/interface, schedule/lease/retry/fencing | Viết adapter theo contract đã duyệt, credentials và payload thật |
| 5.6 | Offer → quán → menu E2E fixtures đạt | Chạy lại với offer/giá hợp lệ từ supplier thật |
| 7.5 | Rerank schema/validation, quota/budget và fallback | Đo model thật: cost/latency và bộ ca regression |
| 8.8 | Desktop/mobile chat, unavailable/ownership/SSE tests đạt | Smoke chat nhiều lượt với credentials thật |
| 11.3 | Resend adapter/outbox/retry và fake tests đạt | Verified sender domain và mailbox được phép để kiểm tra delivery thật |
| 12.10 | Regression, Docker, Coming soon và isolated drills đạt | Deployment target, secrets, domain/DNS và toàn bộ live release gates |

Không thay tám điều kiện này bằng mock rồi đánh dấu hoàn tất. Không cần cung cấp secret trong chat; thêm trực tiếp vào private backend/deployment env.

## Cấu hình thực tế

[backend/.env.example](../backend/.env.example) là danh sách runtime đầy đủ. [EXTERNAL_FOOD_APIS.md](EXTERNAL_FOOD_APIS.md) giải thích phạm vi từng nguồn. Key trống làm nguồn không khả dụng; không tự tạo dữ liệu thật.

| Nhu cầu | Cấu hình |
|---|---|
| Địa điểm/quán | `GOOGLE_PLACES_API_KEY`, `GOONG_API_KEY`, `FOURSQUARE_API_KEY`, `GEOAPIFY_API_KEY`; có thể bật từng nguồn |
| Công thức | `THEMEALDB_API_KEY`, `SPOONACULAR_API_KEY`; kiểm tra quyền dùng/quota của tài khoản trước production |
| AI | `LLM_PROVIDER=gemini`, `LLM_API_KEY`, `LLM_MODEL`, timeout/token/input limits và daily request/USD caps |
| AI cost | `LLM_INPUT_USD_PER_MILLION`, `LLM_OUTPUT_USD_PER_MILLION`, `LLM_PRICING_VALID_UNTIL`; reservation nội bộ không phải hóa đơn provider, cần xác minh giá/model của project trước bật live |
| Background jobs | `WORKER_ENABLED=true` cho cả web và worker; process worker chạy riêng |
| Menu sync | `MENU_SYNC_WORKER_ENABLED=false` tới khi có adapter được phép; chỉ bật sau contract/adapter/live test. Registry trống không enqueue dữ liệu giả |
| Email | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `PUBLIC_APP_URL`, `EMAIL_ALLOWED_ORIGINS`, `EMAIL_OUTBOX_ENCRYPTION_KEY` và timeout; key mã hóa riêng 32 bytes dạng 64 hex |
| Database/auth | `DATABASE_URL`, `JWT_ACCESS_SECRET`; các replica dùng cùng `SECURITY_NAMESPACE`; seed ADMIN bằng env riêng |
| Proxy/quota | `TRUST_PROXY_IPS` chỉ IP cụ thể của proxy tin cậy; blank khi truy cập trực tiếp. `PROVIDER_REQUESTS_PER_MINUTE` dùng counter chung |

Không có runtime `MERCHANT_API_KEY`/`MERCHANT_API_BASE_URL` chung cho một supplier chưa được chọn. Không có `EMAIL_API_KEY`, `LLM_DAILY_BUDGET` hoặc `RETENTION_*`: dùng đúng tên trong example. Retention hiện là defaults đã triển khai và kiểm thử. Không thêm secret vào Vite, git hoặc log. Drain outbox trước xoay encryption key; không thay key khiến jobs đang chờ mất khả năng giải mã.

## Chạy local

Tạo private `backend/.env` từ example, sửa DB/auth secrets. Từ root chạy PostgreSQL; trong backend cài bằng `npm ci`, generate client, apply migrations bằng `npm run db:migrate:deploy`, seed bootstrap khi cần rồi `npm run dev`. Trong frontend chạy `npm ci` và `npm run dev`. Dev frontend: `http://127.0.0.1:5173`; API dependency readiness: `http://127.0.0.1:3001/ready`.

Khi bật jobs, đặt `WORKER_ENABLED=true`, restart web và chạy `npm run worker` trong backend. Email/privacy jobs chạy không cần AI key. Menu jobs còn yêu cầu flag và adapter được cấu hình. Không chạy worker retention/delete tùy tiện trên database đang sử dụng để thử nghiệm.

Compose từ root:

```powershell
docker compose --env-file backend/.env up --build -d
docker compose --env-file backend/.env --profile bootstrap run --rm seed
# Khi WORKER_ENABLED=true và cấu hình đã được review:
docker compose --env-file backend/.env --profile background up --build -d
```

Frontend Compose tại loopback port 8080; API/DB không cần public ports. Bootstrap cần `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` riêng; không seed lại mỗi rollout. Worker có profile `background` và alias `ai`; không phụ thuộc key AI để khởi chạy các jobs khác. `docker compose down` giữ volume, không dùng `down -v` cho database cần bảo toàn.

## Bằng chứng kiểm thử

### Kiểm tra cấu hình và smoke AI

Trong backend, build trước rồi chạy:

```powershell
npm run build
npm run release:check
npm run release:check:db
# Sau khi thêm key/model và kiểm tra giá/quota của project:
npm run release:smoke:ai
# Chọn cap reservation riêng (0,01–10 USD), không đổi daily budget chung:
node scripts/release-check.mjs --live-ai --max-reservation-usd=5
```

Mặc định chỉ đọc cấu hình, không gọi provider và không truy cập DB. `release:check:db` chỉ SELECT migration metadata, so sánh đủ 31 migrations và phát hiện migrations lạ/chưa hoàn tất; không apply migration hoặc sửa dữ liệu. JSON chỉ chứa codes/status/counts, không in giá trị key, URL DB, sender, mô tả khẩu vị hoặc provider output. Exit code 2 là thiếu đầu vào, 1 là config/validation/dependency lỗi, 0 là phạm vi lệnh đã đạt; `CONFIGURED_NOT_LIVE_VERIFIED` không phải full release approval.

`release:smoke:ai` dùng model thật với năm inputs tổng hợp: allergy/budget extraction, grounded ranking, hỏi vị trí thiếu, Coming soon cho giao dịch và recipe nhiều lượt. Dùng đúng production prompts/validators, không ghi profile/conversation/history và không thực thi tool/email. Có ghi atomic daily request/USD counters chung deployment; không reset namespace/quota và không hoàn lại reservation sau lỗi. Default tổng reservation tối đa 5 USD, chặn trước call nếu vượt cap, không tự tăng daily limit, không tự retry và dừng ngay lỗi đầu tiên. Reservation là upper bound bảo thủ, không phải invoice hoặc token cost thật; phải đối chiếu usage của provider khi nghiệm thu 7.5.

Thiếu AI key thì không gọi DB/provider trong chế độ live. CLI không tự đánh dấu OpenSpec hoặc xác nhận live-ready cho menu/email/worker/staging. Mặc dù model contract pass, các gates phân tích async/revision, chat SSE/browser, dữ liệu merchant và delivery email thật vẫn cần riêng. Docker production image chứa script và migration metadata để chạy cùng image đã review. Chi tiết đợt bổ sung: [PLAN_RELEASE_CHECK_VALIDATION.md](PLAN_RELEASE_CHECK_VALIDATION.md).

### Regression và diễn tập hệ thống

Đợt bổ sung CLI chạy lại **80 unit tests**, backend lint/build đạt. Các số database/browser/recovery bên dưới là kết quả đã nghiệm thu ở checkpoint trước; CLI không đổi routes, migrations hoặc frontend nên không gọi các số đó là lượt chạy mới.

Đợt code gần nhất: **71 unit, 132 database, 112 browser desktop/mobile** đạt, 31 migrations chạy từ DB rỗng, backend lint/typecheck và frontend/backend builds đạt. Provider fixtures xác nhận contract và failure behavior; không chứng minh provider live. CI chạy regression với provider giả. Nội dung thông báo: [USER_NOTIFICATIONS.md](USER_NOTIFICATIONS.md). Chi tiết menu sync: [PLAN_MENU_SYNC_VALIDATION.md](PLAN_MENU_SYNC_VALIDATION.md).

Diễn tập sau checkpoint menu sync dùng `rec-food-backend:plan-sync`, `rec-food-frontend:plan-sync`, migration image `rec-food-migrate:plan-ops`; rollback về `rec-food-backend:plan-ai-budget`. Tất cả tạo project/DB/network mới, dữ liệu tổng hợp, cleanup chỉ tài nguyên của drill; không dùng DATABASE_URL của app.

| Gate | Kết quả lượt cuối |
|---|---|
| Deploy | Nginx → DB readiness đạt; worker không có AI chạy; operations chưa login trả 401; startup 14.822 ms, worker stop 467 ms, web stop 855 ms, graceful exit đạt |
| Backup/restore | Lượt recovery riêng: dump 244 ms, restore 602 ms, đến readiness/ownership 2.129 ms. Lượt có load sau đó: 317/651/2.421 ms; hai owners tách biệt, EATEN/cooldown giữ nguyên |
| Rollback/reclaim | Image trước đọc additive schema 31; login/history/ownership/ready đạt; expired lease claim lần hai, token mới, không mất history |
| TLS | Client xác minh bằng Caddy local CA; readiness/frontend 200, metrics 401, HSTS, không cho cross-origin lạ, query riêng tư không vào Nginx logs |
| Load | Mỗi nhóm 40 requests/concurrency 5, 0 failures: discovery p50/p95/p99 104/215/221 ms, analysis 29/52/56 ms, chat 129/159/168 ms; throughput lần lượt 40,14/148,18/37,2 requests/s |

Số đo backup là DB nhỏ, RPO tổng hợp 0 do không có writes sau snapshot. Đây không phải SLA production. Phải đo dataset staging thật và chốt backup/WAL schedule/storage trước release. Load dùng in-process services với PostgreSQL thật, 30 verified fresh offers và fake AI delay 10 ms; không đo HTTP/network hoặc tốc độ model thật. Phương pháp và thresholds trong [PLAN_LOAD_VALIDATION.md](PLAN_LOAD_VALIDATION.md).

Chạy riêng từ backend:

```powershell
node scripts/deployment-drill.mjs
node scripts/recovery-drill.mjs
node scripts/tls-drill.mjs
$env:DRILL_LOAD='true'
node scripts/recovery-drill.mjs
```

Các images mặc định phải build trước, không pull image tùy ý. Recovery nhận `DRILL_CURRENT_IMAGE`/`DRILL_PREVIOUS_IMAGE`/`DRILL_MIGRATION_IMAGE`; deployment/TLS nhận current/frontend overrides. Dùng image đã review. TLS drill từ chối mạng trùng subnet, không thay mạng hiện có.

## Release và rollback

1. Chốt supplier contract/rights và credentials hợp lệ; chạy tám live gates ở trên với phạm vi/quota/mailbox được phép. Không mở strict menu nếu không có offer evidence phù hợp.
2. Chọn Docker host/registry/domain và secret store; pin reviewed image digests, DNS tới host, verified sender origin. Copy [staging env example](../deploy/staging.env.example) sang file riêng ngoài git, bổ sung provider/budget/email env thực.
3. Backup ra storage ngoài DB host, mã hóa, hạn chế quyền đọc; restore thử vào DB cô lập và kiểm tra ownership/history. Chốt RPO/RTO từ dataset và backup schedule thật.
4. Chạy [deploy-staging.ps1](../deploy/deploy-staging.ps1) với `-EnvironmentFile` để validate trước. Script mặc định không apply. Sau nghiệm thu dùng `-Apply`: pull images, pause worker, migrate riêng, đợi ready rồi bật worker. Lỗi rollout giữ worker paused để điều tra.
5. Smoke HTTPS/public DNS, CORS cùng origin, login/session/ownership, source/freshness/price/photos, AI/chat/email, Coming soon; chạy remote staging load và theo dõi quotas/cost/backlog. Không khẳng định certificate public đã được nghiệm thu từ local CA.
6. Rollback code: dừng traffic mới ở proxy, stop worker chờ hoàn tất, chạy image trước tương thích với schema additive, smoke ready/ownership rồi mở traffic. Không migrate down/drop hoặc restore DB chỉ để rollback image. Không chạy worker cũ chưa tương thích đồng thời với queues mới.

Staging proxy chỉ tin edge/Nginx IP cấu hình cố định trong [TLS validation](PLAN_TLS_VALIDATION.md). Kiểm tra subnet không trùng; đổi subnet phải sửa trusted IPs đồng bộ. Public chỉ edge 80/443, cùng-origin `/api`, không wildcard CORS.

Metrics `/admin/metrics` yêu cầu ADMIN. Prometheus config và bảy rules đã syntax-check; ba rule scenarios đạt. Scrape token cần lifecycle/rotation của operator; không dùng token trong browser làm credential lâu dài. Dashboard JSON đã parse/validate nhưng chưa nghiệm thu rendering trên Grafana server. Logs không ghi token/query/vị trí đầy đủ; xem [load/monitoring validation](PLAN_LOAD_VALIDATION.md).

## Schema và tài liệu

50 models/31 migrations, nguồn chính thức [schema.prisma](../backend/prisma/schema.prisma); nhóm schema hiện tại trong [DATABASE_PLAN.md](DATABASE_PLAN.md). Migration đã apply không sửa nội dung: mở rộng bằng migration mới, giữ history/identity trong rollback. Release evidence từng đợt được giữ trong `docs/PLAN_*_VALIDATION.md`, tách số đo lịch sử với lượt mới.
