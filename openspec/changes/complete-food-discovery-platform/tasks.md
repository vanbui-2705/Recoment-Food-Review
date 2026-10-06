## 1. P0 — Baseline và phạm vi

- [x] 1.1 Ghi baseline backend lint/typecheck/unit/DB, frontend browser/build và migration hiện tại; phân biệt test lịch sử với lần chạy mới.
- [x] 1.2 Chốt DTO restaurant/offer/evidence/candidate và error codes theo completion plan; thêm contract fixtures.
- [x] 1.3 Hiển thị Coming soon cho nhóm 9/10 ở UX phù hợp; test không có CTA/tool giao dịch hoạt động.
- [x] 1.4 Kiểm tra toolchain Node/lockfile/Docker/CI và sửa bất tương thích trước module mới.

## 2. P1 — Provider AI và jobs

- [x] 2.1 Xác minh tài liệu provider được chọn; chốt adapter analysis/rerank/chat và config backend validated, không log key.
- [x] 2.2 Tạo migration analysis job/result, uniqueness user/revision/schema và job indexes; chạy migrate-from-empty.
- [x] 2.3 Xây claim/lease/retry worker PostgreSQL và graceful shutdown; test crash recovery và bounded attempts.
- [x] 2.4 Enqueue analysis cùng transaction lưu mô tả; test duplicate save và retry response.
- [x] 2.5 Viết schema extraction catalog-backed, source excerpts và unknown/ambiguous constraints; test malformed output/injection.
- [x] 2.6 Xây apply CAS revision/profile/analyzedRevision và SUPERSEDED; test concurrent edit không bị ghi đè.
- [x] 2.7 Xây review safety changes, giữ dị ứng cũ khi omission; test ambiguity và xác nhận revision stale.
- [x] 2.8 Thêm owner-only analysis start/status/confirm APIs và rate limit; test isolation/validation.
- [x] 2.9 Gắn status/retry/review vào màn hình một ô nhập; test desktop/mobile save-analysis-personalization.
- [ ] 2.10 Chạy AI live smoke khi có key, ghi code-ready/live-ready riêng và cập nhật docs/config.

## 3. P2 — Menu identity và ingest

- [ ] 3.1 Chốt supplier contract và DTO offers/freshness/currency, không chọn API chưa có tài liệu/quyền sử dụng.
- [x] 3.2 Migration external restaurant identities/menu offers/sync runs/quarantine; test uniqueness và nhiều options một món.
- [x] 3.3 Xây canonical mapping tên/alias và review cho ambiguity; test cross-source collisions.
- [x] 3.4 Xây import dry-run/upsert commit idempotent; test nhập lại và invalid price/currency.
- [x] 3.5 Xây paginated sync, complete-snapshot removal và delta rules; test partial failure không đánh hết món.
- [ ] 3.6 Xây freshness/expiry/availability gate và schedule/lease/retry sync; test TTL và worker restart.
- [x] 3.7 Thêm ADMIN sync-run/list/retry/import APIs và auth/quota tests.
- [ ] 3.8 Viết adapter live theo supplier chính thức khi đã có contract/key; test payload thật và lập live-readiness report.

## 4. P2 — Safety evidence

- [x] 4.1 Migration offer-specific allergen/diet/cross-contact evidence và review history với expiry/source.
- [x] 4.2 Xây validator và lifecycle pending/approved/revoked/expired; test evidence mâu thuẫn và quá hạn.
- [x] 4.3 Xây hard safety filter không dùng missing mapping làm ABSENT; test dị ứng/diet/cross-contact kết hợp.
- [x] 4.4 Thêm ADMIN evidence review APIs và audit transaction; test unauthorized review và rollback.
- [x] 4.5 Gắn uncertainty warnings vào discovery chủ động; test không hiển thị nhãn an toàn thiếu evidence.

## 5. P2 — Chi tiết quán và admin ingest UI

- [x] 5.1 Thêm owner-authenticated restaurant detail/menu APIs, pagination, source/freshness và provider-ID validation.
- [x] 5.2 Hoàn thiện media DTO/attribution và credential-free photo handling; test ảnh quán không gắn nhãn ảnh món.
- [x] 5.3 Tạo trang quán menu/budget/detail/Maps/contact với missing-source/empty/error states.
- [x] 5.4 Gắn restaurant navigation từ discovery/dish/wheel; test mobile/back/refresh và quán chưa có menu.
- [x] 5.5 Tạo admin ingest/sync/mapping/evidence views trên API mới; test dry-run/commit/retry/review.
- [ ] 5.6 Chạy E2E offer đủ giá -> quán -> menu, fake-provider trước và live khi có nguồn.

## 6. P3 — Candidate pipeline và recommendation API

- [x] 6.1 Chốt offer/canonical identity cooldown xuyên nguồn; test đúng biên 96h và không gộp món khác nhau.
- [x] 6.2 Ghép profile processed + fresh menus/places + history/dislikes; test stale profile/menu không vào strict candidates.
- [x] 6.3 Áp hard filters safety/diet/budget/radius/opening/availability trước ranking; test phối hợp và không nới khi empty.
- [x] 6.4 Xây bounded weight config, normalized scores 0–100, stable ties và diversity; thêm meaningful ranking tests.
- [x] 6.5 Persist permitted request/result snapshots trên foundation hiện có; test owner privacy và forbidden provider content.
- [x] 6.6 Thêm POST /recommendations và GET /recommendations/:id owner-only/idempotent; giữ today route tương thích.
- [x] 6.7 Lưu budget/radius theo tài khoản và self-load bằng valid location; test GPS thiếu/denied và stale response.
- [x] 6.8 Gắn wheel vào eligible pool và choice event refresh; regression CHOSEN/EATEN/96h và unknown-price opt-in.

## 7. P3 — LLM ranking và giải thích

- [x] 7.1 Viết top-20 candidate prompt/structured result contract và token/deadline/cost limits.
- [x] 7.2 Validate allowed/unique candidate IDs và reasons có căn cứ; test invented IDs/prices/allergy claims/injection.
- [x] 7.3 Xây deterministic fallback và status/metrics cho timeout/JSON sai/quota; test không mất valid candidates.
- [x] 7.4 Gắn reasons/fallback vào frontend và persisted snapshot; test no-match/no-safe-match/pending states.
- [ ] 7.5 Kiểm tra live model với bộ ca đã xác định, ghi cost/latency và regression trước bật tính năng.

## 8. P4 — Chat discovery

- [x] 8.1 Migration conversations/messages/runs/events, owner indexes và idempotency; test lifecycle/cleanup.
- [x] 8.2 Xây conversation/list/detail/messages/delete APIs và ownership tests.
- [x] 8.3 Xây structured context budget/location/profile version và câu hỏi khi thiếu; test multi-turn không đoán tọa độ.
- [x] 8.4 Xây allowlisted tool dispatcher với backend user identity và max-five/deadline; test unauthorized tools/injection.
- [x] 8.5 Xây idempotent run, một run active, authenticated SSE sequence/reconnect/cancel; test disconnect/double submit.
- [x] 8.6 Tạo chat UI streaming/history/retry/cancel và result cards link đến quán/công thức.
- [x] 8.7 Xử lý yêu cầu đặt món/pay/delivery bằng Coming soon; test không tạo giao dịch hoặc expose transaction tools.
- [ ] 8.8 Chạy desktop/mobile E2E nhiều lượt và provider unavailable; live smoke khi đủ credentials.

## 9. P5 — Feedback và lịch sử

- [x] 9.1 Thêm offer/recipe feedback linkage tương thích foundation và API cũ; migration/tests rating semantics.
- [x] 9.2 Xây feedback endpoint validate owned results/types/rating/idempotency; test replay/conflict/isolation.
- [x] 9.3 Thêm cursor history/filter/deletion API; test ownership và preview tác động cooldown.
- [x] 9.4 Xây data-report schema/API/rate limit/status với source reference; test spam và malformed references.
- [x] 9.5 Gắn rating/skip/report/history controls vào frontend; test Google rating tách app rating.
- [x] 9.6 Đưa feedback vào soft ranking và test không sửa allergy/diet; regression cooldown sau xóa được xác nhận.

## 10. P5 — Admin đầy đủ

- [x] 10.1 Migration immutable/redacted admin audit và transactional writer; test rollback/no secret fields.
- [x] 10.2 Hoàn thiện content/catalog/restaurant/offer APIs với soft deactivate; test referenced history bảo toàn.
- [x] 10.3 Thêm user list/block/unblock/session revocation và last-admin guard; test access/refresh sau khóa.
- [x] 10.4 Thêm report triage/resolve/reopen reason và audit; test lifecycle/race.
- [x] 10.5 Tạo ADMIN layout và views content/users/restaurants/reports/audit với pagination/error states.
- [ ] 10.6 Gắn provider health/quota và retry sync vào admin, không render key; test USER bị 403 ở mọi write.
- [x] 10.7 Chạy admin E2E review mapping/evidence/report/block/deactivate và cập nhật hướng dẫn vận hành.

## 11. P6a — Tài khoản, email và riêng tư

- [x] 11.1 Thêm UI đổi mật khẩu/profile name/session/logout-all dùng auth foundation; test session revocation.
- [x] 11.2 Migration hashed single-use email/reset tokens và email outbox; test expiry/replay/unique delivery.
- [ ] 11.3 Viết email adapter với validated config/origin allowlist và retry; fake tests trước, live delivery khi có key.
- [x] 11.4 Thêm forgot/reset/verify/resend APIs, rate limits và generic anti-enumeration responses.
- [x] 11.5 Tạo reset/verify/settings frontend flows và test expired link/retry/no provider.
- [x] 11.6 Xây re-auth protected owner export/delete lifecycle, restricted-content filtering và session revocation.
- [x] 11.7 Implement retention/cleanup defaults và audit anonymization; test cooldown không mất do cleanup sớm.
- [x] 11.8 Cập nhật privacy/terms/account UX theo chức năng thật và Coming soon; E2E export/delete xác nhận rõ.

## 12. P6a/P6b — Vận hành và phát hành

- [x] 12.1 Thêm frontend build/Playwright desktop-mobile và Docker checks vào CI; migration-from-empty regression.
- [x] 12.2 Tách web/worker/migration startup, flags và graceful shutdown; test deployment compatibility.
- [x] 12.3 Thêm DB-aware readiness, redacted request logging và metrics endpoint/access controls.
- [x] 12.4 Instrument provider quota/errors, job backlog, LLM fallback/cost và no-match/latency; test sensitive data không xuất log.
- [x] 12.5 Xây atomic shared rate/quota counters và benchmark concurrency nhiều replica.
- [ ] 12.6 Chuẩn bị TLS/CORS/secrets wiring và staging release scripts theo môi trường thực tế; không hardcode cloud credentials.
- [x] 12.7 Viết và chạy isolated backup/restore drill, đo RPO/RTO và verify ownership/history.
- [x] 12.8 Viết/run rollback rehearsal về image tương thích, worker pause/lease recovery, không drop additive data.
- [x] 12.9 Load test discovery/analysis/chat và lập dashboard/alert thresholds từ số đo.
- [ ] 12.10 Chạy toàn bộ release gates, live-provider checks và Coming soon checks; ghi rõ nguồn chưa live-ready.
- [ ] 12.11 Cập nhật docs/schema/config/runbook và commit từng PR hoàn chỉnh theo đợt; chỉ đánh dấu chức năng hoàn thành khi đủ nghiệm thu.
