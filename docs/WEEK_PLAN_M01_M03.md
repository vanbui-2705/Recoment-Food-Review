# Kế hoạch tuần — M01 đến M03

## Mục tiêu cuối tuần

Hoàn thành một backend có thể:

- khởi động ổn định với Node.js và TypeScript;
- kết nối PostgreSQL, chạy migration và seed;
- đăng ký, đăng nhập, refresh token;
- bảo vệ endpoint `GET /users/me`;
- chạy thành công lint, test và build.

Không làm Taste Profile, recommendation, Google Places hoặc LLM trong tuần này.

## Stack chốt cho tuần này

| Thành phần | Lựa chọn |
|---|---|
| Runtime | Node.js LTS |
| Ngôn ngữ | TypeScript |
| HTTP framework | Fastify |
| Database | PostgreSQL |
| ORM và migration | Prisma |
| Validation | TypeBox + Fastify schema |
| Test | Vitest + Fastify `inject()` |
| Password hashing | Argon2id |
| Token | JWT access token + opaque refresh token |
| Code style | ESLint + Prettier |
| Local database | Docker Compose |

> Không cần cài `pgvector` trong tuần này. Chỉ ghi chú nó là extension sẽ thêm khi triển khai ranking/embedding.

## Kiến trúc mục tiêu

```text
src/
  app.ts
  server.ts
  config/
    env.ts
  common/
    errors/
    http/
    security/
  plugins/
    database.ts
    auth.ts
  modules/
    auth/
      auth.route.ts
      auth.schema.ts
      auth.service.ts
      auth.repository.ts
    users/
      user.route.ts
      user.schema.ts
      user.service.ts
      user.repository.ts
  types/
prisma/
  schema.prisma
  seed.ts
tests/
  integration/
  unit/
```

Luồng phụ thuộc:

```text
route → service → repository → Prisma → PostgreSQL
```

- Route xử lý HTTP và validation.
- Service chứa nghiệp vụ.
- Repository truy cập database.
- Không gọi Prisma trực tiếp từ route.

---

## Ngày 1 — Khởi tạo M01

### Công việc

- Khởi tạo package Node.js và TypeScript.
- Cài Fastify, TypeBox, Vitest, ESLint và Prettier.
- Tạo các script:
  - `dev`;
  - `build`;
  - `start`;
  - `lint`;
  - `format`;
  - `test`;
  - `test:watch`.
- Tạo cấu trúc thư mục nền tảng.
- Tạo `app.ts` để build Fastify instance.
- Tạo `server.ts` chỉ làm nhiệm vụ khởi động server.
- Thêm `.gitignore`, `.editorconfig` và `.env.example`.

### Kết quả cuối ngày

- Server chạy được ở local.
- TypeScript build không lỗi.
- `app.ts` không tự mở port nên có thể dùng trong test.

### Kiểm tra

```text
npm run dev
npm run build
npm run lint
```

---

## Ngày 2 — Config, health check và xử lý lỗi

### Công việc

- Tạo module đọc và validate environment variables khi khởi động.
- Biến môi trường tối thiểu:
  - `NODE_ENV`;
  - `PORT`;
  - `HOST`;
  - `DATABASE_URL`;
  - `JWT_ACCESS_SECRET`;
  - `ACCESS_TOKEN_TTL_SECONDS`;
  - `REFRESH_TOKEN_TTL_DAYS`.
- Tạo `GET /health`.
- Tạo error hierarchy dùng chung:
  - validation error;
  - authentication error;
  - conflict error;
  - not-found error;
  - internal error.
- Tạo global error handler.
- Chuẩn hóa response lỗi.

### Error response đề xuất

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": []
  },
  "request_id": "req-123"
}
```

### Test bắt buộc

- `/health` trả HTTP 200.
- Route không tồn tại trả HTTP 404 theo format chung.
- Env bắt buộc bị thiếu khiến app dừng với thông báo rõ ràng.
- Error handler không trả stack trace cho client.

### Mốc hoàn thành M01

- `npm run lint`, `npm test` và `npm run build` đều thành công.
- Mọi response có request ID.
- Không có secret thật trong repository.

---

## Ngày 3 — PostgreSQL, Prisma và migration M02

### Công việc

- Tạo PostgreSQL local bằng Docker Compose.
- Cài và cấu hình Prisma.
- Thiết kế schema cho phạm vi M02, nhưng chỉ thêm các bảng cần thiết cho M03 trước:
  - `users`;
  - `refresh_tokens`.
- Tạo migration đầu tiên.
- Tạo Fastify database plugin.
- Đóng kết nối database khi app shutdown.

### Schema tối thiểu

#### `users`

| Trường | Yêu cầu |
|---|---|
| `id` | UUID, primary key |
| `email` | unique, normalize lowercase |
| `password_hash` | không nullable |
| `display_name` | nullable hoặc required theo sản phẩm |
| `status` | `ACTIVE`, `DISABLED` |
| `created_at` | timestamp |
| `updated_at` | timestamp |

#### `refresh_tokens`

| Trường | Yêu cầu |
|---|---|
| `id` | UUID, primary key |
| `user_id` | foreign key |
| `token_hash` | unique; không lưu token gốc |
| `expires_at` | timestamp |
| `revoked_at` | nullable timestamp |
| `created_at` | timestamp |

### Lưu ý

- Không lưu access token trong database.
- Không lưu refresh token dạng plain text.
- Email phải được trim và chuyển lowercase trước khi lưu/tìm kiếm.
- Migration phải do Prisma tạo và được commit vào source control.

### Kết quả cuối ngày

- PostgreSQL chạy được bằng Docker Compose.
- Migration chạy trên database rỗng.
- Prisma Client kết nối thành công.

---

## Ngày 4 — Hoàn thiện mô hình dữ liệu và seed M02

### Công việc

- Thêm các model nền tảng chưa dùng ngay nhưng đã thuộc phạm vi dữ liệu:
  - `taste_profiles`;
  - `user_allergies`;
  - `user_dietary_restrictions`;
  - `dishes`;
  - `dish_ingredients`;
  - `dish_allergens`;
  - `restaurants`;
  - `restaurant_dishes`;
  - `user_interactions`.
- Chỉ định foreign key, unique constraint và index.
- Tạo seed development nhỏ:
  - 1 user;
  - 1 taste profile;
  - 3–5 món;
  - 2 quán;
  - mapping món/quán mẫu.
- Viết lệnh reset/seed chỉ dành cho development.

### Test bắt buộc

- Database rỗng chạy toàn bộ migration thành công.
- Seed có thể chạy lại mà không tạo dữ liệu trùng.
- Xóa user xử lý quan hệ con đúng với policy đã định.
- Unique email hoạt động.
- Các foreign key từ chối dữ liệu mồ côi.

### Mốc hoàn thành M02

- Một thành viên mới có thể dựng database chỉ từ README và source code.
- Migration và seed không phụ thuộc thao tác SQL thủ công.
- Schema Prisma có format và validate thành công.

---

## Ngày 5 — Đăng ký và đăng nhập M03

### Công việc

- Tạo `auth.repository`, `auth.service`, `auth.route` và schema validation.
- Triển khai đăng ký:
  - normalize email;
  - kiểm tra email trùng;
  - validate độ dài mật khẩu;
  - hash mật khẩu bằng Argon2id;
  - trả user an toàn, không có `password_hash`.
- Triển khai đăng nhập:
  - trả lỗi chung khi email hoặc mật khẩu sai;
  - phát access token;
  - tạo refresh token ngẫu nhiên;
  - chỉ lưu hash refresh token.

### API contract tối thiểu

```text
POST /auth/register
POST /auth/login
```

Request đăng ký:

```json
{
  "email": "user@example.com",
  "password": "a-strong-password",
  "display_name": "Người dùng"
}
```

Response đăng nhập:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "display_name": "Người dùng"
    },
    "access_token": "token",
    "refresh_token": "token",
    "expires_in": 900
  }
}
```

### Test bắt buộc

- Đăng ký thành công.
- Email khác hoa/thường vẫn được xem là trùng.
- Email sai định dạng bị từ chối.
- Mật khẩu yếu/ngắn bị từ chối.
- Login đúng trả token.
- Email không tồn tại và mật khẩu sai trả cùng thông báo chung.
- Response không chứa password hash.

---

## Ngày 6 — Refresh token, logout và `/users/me`

### Công việc

- Tạo middleware/decorator xác thực access token.
- Tạo `GET /users/me`.
- Tạo `POST /auth/refresh` với refresh token rotation:
  - token cũ bị revoke;
  - token mới được tạo;
  - phát access token mới.
- Tạo `POST /auth/logout` để revoke refresh token.
- Kiểm tra `status` của user trước khi cấp token mới.

### API contract tối thiểu

```text
POST /auth/refresh
POST /auth/logout
GET  /users/me
```

### Test bắt buộc

- Access token hợp lệ truy cập được `/users/me`.
- Thiếu, sai hoặc hết hạn token trả HTTP 401.
- Refresh token hợp lệ được rotate.
- Refresh token cũ không dùng lại được.
- Refresh token hết hạn hoặc bị revoke bị từ chối.
- Logout làm token hiện tại mất hiệu lực.
- User `DISABLED` không thể refresh token.

### Mốc hoàn thành M03

- Toàn bộ route auth có validation.
- Không log password hoặc token.
- Secret JWT chỉ lấy từ environment.
- User không đọc được dữ liệu riêng của user khác.

---

## Ngày 7 — Integration test, tài liệu và buffer

### Công việc

- Chạy lại toàn bộ flow trên database test riêng:

```text
register → login → users/me → refresh → users/me → logout
```

- Bổ sung integration tests còn thiếu.
- Kiểm tra graceful shutdown.
- Viết README hướng dẫn:
  - yêu cầu môi trường;
  - cài dependencies;
  - chạy PostgreSQL;
  - cấu hình `.env`;
  - migration và seed;
  - chạy server và test.
- Dọn lint warning, TODO tạm và code không dùng.
- Dùng thời gian còn lại làm buffer cho lỗi migration/auth.

### Cổng chất lượng cuối tuần

Tất cả lệnh sau phải thành công:

```text
npm run lint
npm test
npm run build
```

Kiểm tra thủ công:

- Clone/cài mới có thể dựng app theo README.
- Database development và test tách biệt.
- `.env`, token và secret không được commit.
- API lỗi không lộ stack trace hoặc dữ liệu nhạy cảm.

---

## Danh sách test tối thiểu toàn tuần

### M01

- Health check thành công.
- Not-found và internal error đúng format.
- Env validation hoạt động.

### M02

- Migration trên database rỗng.
- Seed idempotent.
- Unique constraint và foreign key hoạt động.
- Database plugin đóng kết nối đúng cách.

### M03

- Register success/duplicate/invalid input.
- Login success/wrong password/unknown email.
- Protected route success/missing token/expired token.
- Refresh success/expired/revoked/reused token.
- Logout thành công.
- Response không chứa credential/hash.

## Những việc không nên làm trong tuần này

- Không viết recommendation engine.
- Không tích hợp LLM hoặc Google Places.
- Không thêm Redis nếu chưa có nhu cầu thực tế.
- Không triển khai OAuth/social login trong MVP đầu tiên.
- Không xây quyền admin phức tạp.
- Không tối ưu database khi chưa có truy vấn thực tế.
- Không lưu refresh token hoặc mật khẩu dạng plain text.

## Ưu tiên khi thiếu thời gian

Nếu không đủ thời gian, giảm phạm vi theo thứ tự:

1. Hoãn các bảng M02 chưa được M03 sử dụng, nhưng ghi lại migration plan.
2. Hoãn logout tất cả thiết bị; vẫn giữ logout phiên hiện tại.
3. Hoãn refresh token đa thiết bị nâng cao.
4. Không bỏ test cho password hashing, authentication và token rotation.

Không cắt bỏ env validation, migration, password hashing, quyền sở hữu dữ liệu hoặc các test bảo mật cốt lõi.

## Checklist bàn giao cuối tuần

- [ ] `/health` hoạt động.
- [ ] TypeScript build thành công.
- [ ] Lint và test thành công.
- [ ] PostgreSQL dựng được bằng Docker Compose.
- [ ] Migration chạy được trên database rỗng.
- [ ] Seed chạy lặp lại không trùng dữ liệu.
- [ ] Đăng ký hoạt động.
- [ ] Đăng nhập hoạt động.
- [ ] Refresh token rotation hoạt động.
- [ ] Logout hoạt động.
- [ ] `/users/me` được bảo vệ.
- [ ] Không có secret trong source/log.
- [ ] README đủ để dựng dự án từ đầu.
