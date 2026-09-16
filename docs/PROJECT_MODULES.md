# Lộ trình phát triển theo module — Rec-Food

## Cách sử dụng tài liệu

Triển khai các module theo thứ tự từ **M01** đến **M12**. Mỗi module chỉ được xem là hoàn thành khi đạt toàn bộ tiêu chí trong phần **Definition of Done**.

Nguyên tắc chung:

- Hoàn thành và kiểm thử một module trước khi chuyển sang module kế tiếp.
- Dị ứng, chế độ ăn bắt buộc, ngân sách tối đa và khoảng cách tối đa phải được xử lý bằng code backend, không giao cho LLM quyết định.
- API bên ngoài và LLM phải được đặt sau interface riêng để dễ mock khi kiểm thử.
- MVP dừng ở M10. M11–M12 là phần hoàn thiện vận hành và mở rộng.

## Tổng quan phụ thuộc

```text
M01 Khởi tạo dự án
 ├─> M02 Cơ sở dữ liệu
 │    ├─> M03 Xác thực người dùng
 │    ├─> M04 Hồ sơ khẩu vị
 │    └─> M05 Kho dữ liệu món ăn
 │          └─> M06 Hard Filter
 ├─> M07 Places & vị trí
 │          └─> M08 Ranking cơ bản
 │                 └─> M09 LLM Re-ranking
 │                        └─> M10 Recommendation API
 └────────────────────────────> M11 Kiểm thử, quan sát, bảo mật
                                └─> M12 CI/CD và triển khai
```

---

## M01 — Khởi tạo backend

### Mục tiêu

Tạo nền tảng Node.js/TypeScript có cấu hình môi trường, kiểm tra chất lượng code và cấu trúc thư mục nhất quán.

### Phạm vi

- Node.js + TypeScript.
- HTTP framework: Fastify hoặc Express; khuyến nghị Fastify để có validation và hiệu năng tốt.
- Quản lý biến môi trường và validation khi khởi động.
- ESLint, Prettier, test runner.
- Endpoint kiểm tra trạng thái dịch vụ.
- Error handler và response format dùng chung.

### Cấu trúc gợi ý

```text
src/
  app.ts
  server.ts
  config/
  common/
  modules/
tests/
```

### Đầu ra

- `GET /health` trả HTTP 200.
- Lệnh chạy development, build, lint và test.
- `.env.example` không chứa secret thật.

### Definition of Done

- Project khởi động được bằng một lệnh.
- Build TypeScript không lỗi.
- Lint và test chạy thành công.
- Lỗi API có cấu trúc JSON thống nhất.

---

## M02 — PostgreSQL và mô hình dữ liệu

### Mục tiêu

Thiết lập PostgreSQL, migration và schema nền tảng cho người dùng, khẩu vị, món ăn, quán và lịch sử tương tác.

### Phạm vi

- Kết nối PostgreSQL bằng ORM/query builder đã chọn.
- Migration có thể chạy tiến/lùi an toàn.
- Các bảng chính:
  - `users`;
  - `taste_profiles`;
  - `user_allergies`;
  - `user_dietary_restrictions`;
  - `dishes`;
  - `dish_ingredients`;
  - `dish_allergens`;
  - `restaurants`;
  - `restaurant_dishes`;
  - `user_interactions`.
- Seed dữ liệu development tối thiểu.
- Chuẩn bị extension `pgvector`, nhưng chưa bắt buộc dùng trong MVP đầu tiên.

### Quyết định quan trọng

- Giá lưu bằng VND dưới dạng số nguyên.
- Tọa độ phải có latitude/longitude hợp lệ.
- Dị nguyên dùng mã chuẩn nội bộ, không chỉ lưu tên tự do.
- Dữ liệu dị nguyên cần trường nguồn và trạng thái xác minh.

### Definition of Done

- Database mới có thể được dựng hoàn toàn bằng migration.
- Seed tạo được user, profile, món và quán mẫu.
- Có index cho khóa ngoại và các trường tìm kiếm thường dùng.
- Không lưu embedding trực tiếp trong JSON nếu đã dùng `pgvector`.

---

## M03 — Xác thực và người dùng

### Mục tiêu

Cung cấp định danh người dùng để mọi profile và lịch sử đều có chủ sở hữu rõ ràng.

### Phạm vi

- Đăng ký, đăng nhập và lấy thông tin người dùng hiện tại.
- Hash mật khẩu bằng thuật toán phù hợp.
- Access token và cơ chế refresh token nếu ứng dụng cần phiên dài.
- Middleware xác thực và phân quyền tài nguyên theo `user_id`.

### API tối thiểu

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /users/me
```

### Definition of Done

- Không lưu mật khẩu dạng plain text.
- User không thể đọc hoặc sửa dữ liệu của user khác.
- Có test cho đăng ký, đăng nhập, token sai và token hết hạn.
- Không ghi token hoặc mật khẩu vào log.

---

## M04 — Hồ sơ khẩu vị và ràng buộc

### Mục tiêu

Cho phép người dùng khai báo và cập nhật sở thích, món ghét, chế độ ăn, dị ứng và ngân sách.

### Phạm vi

- CRUD taste profile.
- Chuẩn hóa thang khẩu vị `0.0–1.0`.
- Danh mục cuisine, diet và allergen.
- Validate khoảng ngân sách.
- Tách dị ứng khỏi sở thích mềm ở tầng dữ liệu và service.

### API tối thiểu

```text
GET   /me/taste-profile
PUT   /me/taste-profile
POST  /me/allergies
DELETE /me/allergies/:allergenId
```

### Definition of Done

- Có thể tạo đầy đủ profile onboarding.
- Dữ liệu không hợp lệ trả lỗi rõ ràng.
- Dị ứng không thể bị ghi nhầm vào danh sách preference mềm.
- Có test quyền sở hữu và validation.

---

## M05 — Dish Knowledge Base

### Mục tiêu

Xây kho tri thức món Việt có cấu trúc để hard filter và ranking không phải suy đoán bằng LLM.

### Phạm vi

- CRUD món ăn dành cho admin/import job.
- Thành phần chính, tag, cuisine, meal period và khoảng giá tham chiếu.
- Mapping món ↔ dị nguyên.
- Alias tên món để hỗ trợ dữ liệu quán không đồng nhất.
- Import dataset từ CSV/JSON.
- Ban đầu seed khoảng 100–200 món Việt phổ biến.

### Trường an toàn cần có

```text
allergen_code
evidence_source
verification_status
verified_at
```

### Definition of Done

- Tìm được món theo tên, alias và tag.
- Mỗi quan hệ dị nguyên có nguồn/trạng thái xác minh.
- Import chạy lặp lại không tạo bản ghi trùng.
- Có test cho chuẩn hóa tên và mapping dị nguyên.

---

## M06 — Hard Filter an toàn

### Mục tiêu

Loại mọi ứng viên vi phạm ràng buộc bắt buộc trước khi ranking hoặc gọi LLM.

### Phạm vi

- Filter theo dị ứng.
- Filter theo chế độ ăn bắt buộc.
- Filter theo ngân sách tối đa.
- Filter theo khoảng cách tối đa.
- Filter quán đóng cửa khi dữ liệu giờ mở cửa đủ tin cậy.
- Trả lý do loại theo mã máy đọc được.

### Interface gợi ý

```ts
type FilterResult = {
  accepted: Candidate[];
  rejected: Array<{
    candidateId: string;
    reasonCodes: string[];
  }>;
};
```

### Definition of Done

- Không có ứng viên xung đột dị ứng trong `accepted`.
- Dữ liệu dị nguyên chưa xác minh được đánh dấu để cảnh báo theo policy đã chọn.
- Có unit test cho từng rule và nhiều rule đồng thời.
- LLM không được gọi trong module này.

---

## M07 — Places và vị trí

### Mục tiêu

Lấy dữ liệu quán thực tế gần người dùng và chuyển về model nội bộ thống nhất.

### Phạm vi

- Adapter cho Google Places API v1.
- Nearby search theo tọa độ và bán kính.
- Field mask tối thiểu để kiểm soát chi phí.
- Cache kết quả với TTL.
- Tính/chuẩn hóa khoảng cách.
- Mapping Place ↔ restaurant nội bộ.
- Timeout, retry có giới hạn và xử lý quota.

### Definition of Done

- Service trả model nội bộ, không làm rò cấu trúc response của Google sang domain layer.
- Có mock adapter để test không gọi API thật.
- Cache key bao gồm khu vực, bán kính và loại địa điểm.
- Không log API key.
- Khi Places lỗi, API trả lỗi có kiểm soát hoặc fallback từ cache.

---

## M08 — Candidate Generation và ranking cơ bản

### Mục tiêu

Tạo danh sách ứng viên đã lọc và xếp hạng bằng thuật toán xác định, chưa phụ thuộc LLM.

### Phạm vi

- Ghép dish knowledge base với restaurant/place.
- Tính điểm theo tag/cuisine/khẩu vị/ngữ cảnh.
- Kết hợp khoảng cách, ngân sách và tín hiệu lịch sử.
- Giảm điểm món vừa ăn gần đây.
- Đa dạng hóa top-N.
- Lưu breakdown điểm để debug nội bộ.

### Công thức khởi đầu gợi ý

```text
base_score =
  0.30 * preference_match +
  0.20 * context_match +
  0.20 * budget_match +
  0.15 * distance_match +
  0.10 * quality_signal +
  0.05 * novelty
```

Trọng số phải nằm trong config để có thể điều chỉnh mà không sửa thuật toán lõi.

### Definition of Done

- Cùng input và config luôn cho cùng output.
- Chỉ nhận dữ liệu từ kết quả `accepted` của M06.
- Có test cho điểm biên, tie-break và đa dạng hóa.
- Trả được top-N khi LLM bị tắt.

---

## M09 — LLM Re-ranking và giải thích

### Mục tiêu

Dùng LLM để sắp xếp lại top ứng viên theo ngữ cảnh tự nhiên và sinh lời giải thích có căn cứ.

### Phạm vi

- Dùng [system_prompt.md](./system_prompt.md).
- LLM provider interface để có thể đổi model/provider.
- Chỉ gửi top-N ứng viên đã qua M06 và M08.
- Structured JSON output và schema validation.
- Timeout, retry giới hạn, chi phí/token logging không chứa PII.
- Fallback về ranking M08 nếu LLM lỗi hoặc trả JSON sai.
- Chống prompt injection từ request và dữ liệu candidate.

### Definition of Done

- LLM không thể đề xuất ID ngoài input candidates.
- Output được validate trước khi trả về client.
- JSON sai hoặc timeout không làm hỏng recommendation flow.
- Có test bằng fake provider cho success, timeout, malformed JSON và invented ID.

---

## M10 — Recommendation API hoàn chỉnh

### Mục tiêu

Ghép profile, context, Places, hard filter, ranking và LLM thành một use case duy nhất.

### Luồng xử lý

```text
Request
  → tải Taste Profile
  → tìm/mapping candidate
  → Hard Filter
  → Base Ranking
  → LLM Re-ranking
  → validate output
  → response
```

### API tối thiểu

```text
POST /recommendations
GET  /recommendations/:requestId
```

### Response cần có

- Danh sách đề xuất có thứ hạng.
- Lý do ngắn cho từng kết quả.
- Cảnh báo dữ liệu dị nguyên chưa xác minh.
- Trạng thái `success`, `no_match`, `no_safe_match` hoặc `insufficient_data`.
- `request_id` để truy vết.

### Definition of Done

- Luồng end-to-end chạy với dữ liệu seed và Places/LLM mock.
- Không có hard constraint nào bị LLM ghi đè.
- Có rate limit và giới hạn kích thước request.
- Response không làm lộ prompt, stack trace hoặc dữ liệu nội bộ.
- Có integration test cho cả bốn trạng thái response.

---

## M11 — Feedback và lịch sử hành vi

### Mục tiêu

Thu thập tín hiệu để cải thiện đề xuất mà không tự động làm thay đổi dị ứng hoặc ràng buộc an toàn.

### Phạm vi

- Ghi nhận `liked`, `skipped`, `chosen`, `eaten`, `rated`.
- Chống ghi trùng bằng idempotency key.
- Cập nhật tín hiệu preference mềm.
- Lưu lịch sử đủ dùng và có chính sách retention.

### API tối thiểu

```text
POST /recommendations/:requestId/feedback
GET  /me/interactions
```

### Definition of Done

- Feedback không tự sửa danh sách dị ứng.
- Event trùng không được tính hai lần.
- Ranking M08 có thể sử dụng lịch sử gần đây.
- User có thể xem/xóa lịch sử của chính mình theo policy sản phẩm.

---

## M12 — Kiểm thử, quan sát và triển khai

### Mục tiêu

Đưa ứng dụng lên Cloud Run với quy trình triển khai lặp lại được và đủ khả năng phát hiện lỗi.

### Phạm vi

- Unit, integration và end-to-end tests.
- Structured logging với `request_id`.
- Metrics: latency, error rate, no-match rate, LLM fallback rate và chi phí API.
- Secret Manager cho database, Places và LLM keys.
- Dockerfile chạy non-root.
- GitHub Actions: lint → test → build → deploy.
- Migration job tách khỏi web process.
- Runbook rollback và xử lý sự cố.

### Definition of Done

- Pipeline chặn deploy khi lint/test/build lỗi.
- Cloud Run health check hoạt động.
- Secret không nằm trong image, source hoặc log.
- Có dashboard/log query để truy vết một recommendation request.
- Có thể rollback về revision trước.

---

## Phạm vi MVP

MVP đầu tiên bao gồm:

- M01–M10;
- dữ liệu 100–200 món Việt;
- một thành phố khởi đầu: Hà Nội;
- một nhà cung cấp Places;
- một LLM provider;
- ranking rule-based/content-based, chưa cần collaborative filtering;
- giao diện gọi API cơ bản, chưa cần voice hoặc recommendation nhóm.

## Ngoài phạm vi MVP

Các hạng mục sau chỉ thực hiện sau khi MVP có dữ liệu sử dụng thực tế:

- Collaborative filtering.
- Embedding/vector search nâng cao.
- Gợi ý nhóm nhiều người.
- Hội thoại voice.
- Nhiều nhà cung cấp bản đồ.
- Tự động suy luận dị ứng từ hành vi.
- Dinh dưỡng hoặc khuyến nghị y khoa.

## Thứ tự làm việc đề xuất

| Giai đoạn | Module | Kết quả có thể kiểm chứng |
|---|---|---|
| 1 | M01 | Backend chạy và có `/health` |
| 2 | M02 | Database migration + seed hoạt động |
| 3 | M03–M04 | User đăng nhập và tạo taste profile |
| 4 | M05 | Có kho món Việt truy vấn được |
| 5 | M06 | Hard filter có bộ test an toàn |
| 6 | M07 | Tìm được quán gần vị trí mẫu |
| 7 | M08 | Có top-N không cần LLM |
| 8 | M09 | LLM re-rank có fallback |
| 9 | M10 | Recommendation API end-to-end |
| 10 | M11–M12 | Feedback, vận hành và deploy |

## Quy ước khi bắt đầu từng module

Khi bắt đầu một module, cần chốt bốn nội dung:

1. Stack/thư viện cụ thể sẽ dùng.
2. File và database migration cần tạo.
3. API contract hoặc interface của module.
4. Test cases bắt buộc trước khi viết code.

Không triển khai trước logic của module tiếp theo. Chỉ tạo interface/mock nếu module hiện tại cần nó để kiểm thử.
