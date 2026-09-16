# Rec-Food — Architecture & Codebase Guide

## 1. Mục đích tài liệu

Tài liệu này là bản đồ kỹ thuật dành cho:

- developer cần hiểu nhanh codebase;
- AI agent cần xác định đúng vị trí đọc hoặc tạo code;
- reviewer cần kiểm tra ranh giới giữa các module;
- thành viên mới cần biết phần nào đã có và phần nào mới chỉ là kế hoạch.

Đây là tài liệu mô tả **kiến trúc codebase**. Lộ trình chức năng chi tiết nằm trong [`PROJECT_MODULES.md`](./PROJECT_MODULES.md), còn system prompt của recommendation LLM nằm trong [`system_prompt.md`](./system_prompt.md).

> Quy tắc quan trọng: luôn phân biệt giữa **Current state** và **Target architecture**. Không được giả định một file, bảng dữ liệu hoặc tính năng đã tồn tại chỉ vì nó xuất hiện trong phần kiến trúc mục tiêu.

---

## 2. Bài toán hệ thống

Rec-Food là ứng dụng gợi ý món ăn cá nhân hóa theo:

- sở thích và món không thích;
- khẩu vị;
- chế độ ăn;
- dị ứng;
- ngân sách;
- khoảng cách;
- thời gian và thời tiết;
- lịch sử lựa chọn của người dùng.

Luồng recommendation mục tiêu gồm ba tầng:

1. **Hard filter:** loại ứng viên vi phạm dị ứng, chế độ ăn và giới hạn bắt buộc.
2. **Base ranking:** chấm điểm ứng viên bằng logic xác định.
3. **LLM re-ranking:** sắp xếp lại top ứng viên và sinh lời giải thích.

LLM không được quyết định an toàn dị ứng và không được tạo món/quán ngoài danh sách backend cung cấp.

---

## 3. Current state — trạng thái hiện tại

Tại thời điểm cập nhật tài liệu này, codebase đã có:

- Node.js + TypeScript backend;
- Fastify application;
- biến môi trường được đọc bằng `dotenv` và validate tập trung;
- endpoint `GET /health`;
- logging mặc định của Fastify;
- error response chuẩn hóa cho validation, 404 và 500;
- graceful shutdown cho `SIGINT` và `SIGTERM`;
- unit test và integration test bằng Vitest;
- ESLint, Prettier và EditorConfig;
- PostgreSQL 17 local bằng Docker Compose;
- Prisma ORM 7 với migration-first workflow;
- database plugin quản lý connection pool theo Fastify lifecycle;
- schema authentication gồm `users` và `refresh_tokens`;
- schema DB02 gồm taste profile, allergen, dietary restriction, cuisine và các quan hệ theo user;
- migrations `20260916134059_init_auth`, `20260916135938_add_taste_profile` và development seed idempotent;
- lệnh development, build, lint, format và test trong `package.json`.

Codebase **chưa có**:

- frontend implementation;
- authentication;
- API và business service cho taste profile;
- dish knowledge base;
- hard filter;
- Places integration;
- recommendation engine;
- LLM integration;

### Cây file hiện tại

```text
Rec-Food/
├── backend/
│   ├── src/
│   │   ├── common/
│   │   │   └── errors/
│   │   │       ├── app-error.ts
│   │   │       └── error-handler.ts
│   │   ├── config/
│   │   │   └── env.ts
│   │   ├── plugins/
│   │   │   └── database.plugin.ts
│   │   ├── modules/
│   │   │   └── health/
│   │   │       └── health.route.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/
│   │   ├── database/
│   │   │   └── database.test.ts
│   │   ├── integration/
│   │   │   └── app.test.ts
│   │   └── unit/
│   │       └── env.test.ts
│   ├── prisma/
│   │   ├── migrations/
│   │   │   ├── 20260916134059_init_auth/
│   │   │   │   └── migration.sql
│   │   │   └── 20260916135938_add_taste_profile/
│   │   │       └── migration.sql
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── .env.example
│   ├── .prettierignore
│   ├── .prettierrc.json
│   ├── eslint.config.mjs
│   ├── compose.yaml
│   ├── package.json
│   ├── package-lock.json
│   ├── prisma.config.ts
│   ├── tsconfig.json
│   ├── vitest.config.mts
│   └── vitest.database.config.mts
├── frontend/
│   ├── public/                     # Chưa có implementation
│   ├── src/                        # Chưa có implementation
│   └── tests/                      # Chưa có implementation
└── docs/
    ├── ARCHITECTURE.md
    ├── DATABASE_PLAN.md
    ├── PROJECT_MODULES.md
    ├── WEEK_PLAN_M01_M03.md
    └── system_prompt.md
```

Các thư mục rỗng đã được chuẩn bị trước nhưng không đồng nghĩa với việc module đã hoàn thành.

---

## 4. Kiến trúc tổng thể mục tiêu

```text
[React Web Client]
        │ HTTPS/JSON
        ▼
[Fastify Backend API]
        ├── Auth & Users
        ├── Taste Profile
        ├── Dish Knowledge Base
        ├── Places Adapter
        └── Recommendation Engine
                ├── Hard Filter
                ├── Base Ranking
                └── LLM Re-ranking
        │
        ├──────────────► [PostgreSQL]
        ├──────────────► [Google Places API]
        └──────────────► [LLM Provider]
```

### Ranh giới hệ thống

- Frontend chỉ gọi backend API; không kết nối trực tiếp database, Places hoặc LLM.
- Backend là nơi thực thi business rules và kiểm soát quyền truy cập.
- PostgreSQL là nguồn sự thật của user, profile, món ăn và lịch sử.
- Places provider chỉ cung cấp dữ liệu địa điểm/quán.
- LLM chỉ re-rank và giải thích danh sách đã lọc.

---

## 5. Backend architecture

Backend tổ chức theo **feature module**, kết hợp phân lớp bên trong từng module.

```text
route → service → repository → database/external adapter
```

### Trách nhiệm từng lớp

| Lớp | Trách nhiệm | Không nên làm |
|---|---|---|
| `route` | Khai báo HTTP method/path, schema, status code và gọi service | Không chứa query database hoặc business logic dài |
| `schema` | Request/response validation và type contract | Không truy cập database |
| `service` | Business rules và điều phối use case | Không phụ thuộc trực tiếp Fastify request/reply |
| `repository` | Đọc/ghi database | Không quyết định HTTP status |
| `adapter` | Giao tiếp dịch vụ ngoài như Places/LLM | Không chứa business rule cốt lõi |
| `plugin` | Tích hợp hạ tầng vào Fastify lifecycle | Không chứa logic domain |

### Cấu trúc backend mục tiêu

```text
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── common/
│   │   ├── errors/
│   │   ├── http/
│   │   ├── security/
│   │   └── utils/
│   ├── config/
│   │   └── env.ts
│   ├── plugins/
│   │   ├── database.plugin.ts
│   │   └── auth.plugin.ts
│   ├── modules/
│   │   ├── health/
│   │   │   └── health.route.ts
│   │   ├── auth/
│   │   │   ├── auth.route.ts
│   │   │   ├── auth.schema.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.repository.ts
│   │   ├── users/
│   │   ├── taste-profiles/
│   │   ├── dishes/
│   │   ├── restaurants/
│   │   ├── places/
│   │   └── recommendations/
│   │       ├── recommendation.route.ts
│   │       ├── recommendation.schema.ts
│   │       ├── recommendation.service.ts
│   │       ├── hard-filter.service.ts
│   │       ├── ranking.service.ts
│   │       └── llm-reranker.adapter.ts
│   ├── types/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   └── integration/
├── .env.example
├── package.json
└── tsconfig.json
```

Không tạo tất cả file mục tiêu cùng lúc. Chỉ tạo khi triển khai module tương ứng trong roadmap.

---

## 6. Vai trò các file backend hiện có

### `src/server.ts`

Entry point của process Node.js.

Trách nhiệm hiện tại:

- load `.env` bằng `dotenv/config`;
- gọi `buildApp()`;
- lấy config đã validate từ `config/env.ts`;
- mở HTTP listener;
- log lỗi khởi động;
- đóng server an toàn khi nhận `SIGINT` hoặc `SIGTERM`.

File này không nên đăng ký route hoặc chứa business logic.

### `src/app.ts`

Composition root của ứng dụng Fastify.

Trách nhiệm hiện tại:

- tạo Fastify instance;
- bật logger;
- đăng ký global error handler;
- đăng ký `healthRoutes`;
- trả instance cho server hoặc test.

Mọi plugin/module cấp ứng dụng sẽ được đăng ký tại đây. File này không gọi `listen()` để integration test có thể dùng `app.inject()`.

### `src/modules/health/health.route.ts`

Khai báo endpoint:

```text
GET /health
```

Response hiện tại:

```json
{
  "status": "ok",
  "service": "Rec-Food Backend",
  "timestamp": "ISO-8601 timestamp"
}
```

Health route chỉ xác nhận process HTTP đang phản hồi. Khi có database, có thể bổ sung readiness check riêng; không nên biến endpoint liveness thành một truy vấn nặng.

### `tsconfig.json`

Thiết lập TypeScript:

- target JavaScript: ES2022;
- module system: NodeNext;
- source: `src`;
- output: `dist`;
- strict type checking;
- source maps;
- test nằm ngoài production build.

### `package.json`

Các lệnh hiện tại:

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | Chạy backend bằng `tsx watch` |
| `npm run build` | Compile `src` sang `dist` |
| `npm start` | Chạy bản build trong `dist` |
| `npm run lint` | Kiểm tra ESLint |
| `npm run lint:fix` | Tự sửa lỗi lint có thể sửa an toàn |
| `npm run format` | Format code bằng Prettier |
| `npm test` | Chạy Vitest một lần |

---

## 7. Luồng request hiện tại

```text
Client
  │ GET /health
  ▼
server.ts
  │ process đã listen tại HOST:PORT
  ▼
app.ts
  │ Fastify tìm route đã đăng ký
  ▼
health.route.ts
  │ tạo response object
  ▼
Fastify serialize JSON
  ▼
Client nhận HTTP 200
```

`server.ts` không trực tiếp gọi `health.route.ts`. `app.ts` đăng ký module để Fastify điều phối request.

---

## 8. Recommendation flow mục tiêu

```text
POST /recommendations
  │
  ├─► xác thực user
  ├─► tải taste profile và hard constraints
  ├─► lấy/mapping dish + restaurant candidates
  ├─► hard filter
  │     ├── allergies
  │     ├── mandatory diet
  │     ├── maximum budget
  │     └── maximum distance
  ├─► deterministic base ranking
  ├─► gửi top-N sang LLM re-ranker
  ├─► validate JSON và candidate IDs từ LLM
  └─► trả recommendation response
```

Nếu LLM timeout, trả JSON sai hoặc tạo ID mới, backend phải fallback về base ranking. Lỗi LLM không được làm vô hiệu hard filter.

---

## 9. Frontend architecture mục tiêu

Frontend chưa được triển khai. Cấu trúc dự kiến:

```text
frontend/
├── public/
├── src/
│   ├── api/                       # HTTP client và API contracts
│   ├── assets/                    # Asset tĩnh
│   ├── components/                # Component dùng chung
│   ├── features/
│   │   ├── auth/
│   │   ├── taste-profile/
│   │   └── recommendations/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   ├── styles/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
├── tests/
├── package.json
└── vite.config.ts
```

### Quy tắc frontend

- `features` chứa UI và logic gắn với một nghiệp vụ cụ thể.
- `components` chỉ chứa thành phần thực sự dùng chung.
- `api` là cổng duy nhất gọi backend.
- Không để React component gọi thẳng Places hoặc LLM.
- Không đưa secret vào biến môi trường `VITE_*`; các biến này được nhúng vào browser bundle.

---

## 10. Quy tắc phụ thuộc

### Được phép

```text
route → schema
route → service
service → repository
service → adapter interface
repository → database client
adapter implementation → external SDK/API
```

### Không được phép

```text
repository → route
repository → Fastify reply
service → Fastify request
domain logic → process.env trực tiếp
frontend → database
frontend → LLM provider
LLM → hard-filter decision
```

Biến môi trường chỉ nên được đọc/validate trong `config`. Các module khác nhận config qua dependency hoặc plugin thay vì tự gọi `process.env` rải rác.

---

## 11. Quy ước tên file và code

| Thành phần | Quy ước | Ví dụ |
|---|---|---|
| Route | `*.route.ts` | `auth.route.ts` |
| Validation schema | `*.schema.ts` | `auth.schema.ts` |
| Business service | `*.service.ts` | `auth.service.ts` |
| Database repository | `*.repository.ts` | `user.repository.ts` |
| External integration | `*.adapter.ts` | `places.adapter.ts` |
| Fastify plugin | `*.plugin.ts` | `database.plugin.ts` |
| Unit test | `*.test.ts` | `hard-filter.test.ts` |

Quy ước bổ sung:

- thư mục và file dùng kebab-case;
- class/type/interface dùng PascalCase;
- function/variable dùng camelCase;
- constant dùng UPPER_SNAKE_CASE khi thực sự là hằng số toàn cục;
- route path dùng danh từ số nhiều, ví dụ `/users`, `/recommendations`;
- ID truyền qua các lớp dưới dạng string, không tự đổi hoặc tạo lại ID của provider.

---

## 12. Error handling mục tiêu

Response lỗi thống nhất:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu đầu vào không hợp lệ",
    "details": []
  },
  "request_id": "req-123"
}
```

Quy tắc:

- route/service ném lỗi domain đã chuẩn hóa;
- global error handler chuyển lỗi thành HTTP response;
- lỗi 500 không trả stack trace cho client;
- log phải có request ID;
- không log password, access token, refresh token hoặc API key.

---

## 13. Testing strategy

### Unit tests

Đặt tại `backend/tests/unit` hoặc cạnh module nếu team đổi convention sau này.

Tập trung kiểm tra:

- service/business rules;
- hard filter;
- ranking;
- config parsing;
- utility functions.

### Integration tests

Đặt tại `backend/tests/integration`.

Tập trung kiểm tra:

- route bằng `app.inject()`;
- request validation;
- authentication middleware;
- database repository với test database;
- response/error contract.

Không gọi API trả phí thật trong test. Places và LLM phải có fake/mock adapter.

---

## 14. Security và safety rules

- Không commit `.env` hoặc secret.
- Password phải được hash; không lưu/log plain text.
- Refresh token phải lưu dưới dạng hash.
- Mọi tài nguyên user phải kiểm tra ownership.
- Validate toàn bộ request tại HTTP boundary.
- Giới hạn kích thước request và rate limit endpoint nhạy cảm.
- Dị ứng là hard constraint, không phải preference mềm.
- Không tuyên bố món an toàn nếu allergen data chưa được xác minh.
- Không gửi dữ liệu cá nhân không cần thiết sang Places hoặc LLM.

---

## 15. Hướng dẫn cho AI agent

Trước khi thay đổi code, agent phải:

1. Đọc file này và module liên quan trong `PROJECT_MODULES.md`.
2. Kiểm tra cây file thực tế; không suy ra file từ target architecture.
3. Đọc toàn bộ file sẽ sửa và các dependency trực tiếp của nó.
4. Giữ thay đổi trong đúng module người dùng yêu cầu.
5. Không triển khai trước module tiếp theo nếu chưa được yêu cầu.
6. Không sửa code người dùng ngoài phạm vi để “dọn đẹp”.
7. Không tự ý thêm package khi có thể giải quyết bằng dependency hiện tại.
8. Nếu thêm package, giải thích vai trò và cập nhật lockfile.
9. Chạy kiểm tra phù hợp sau thay đổi: typecheck, lint, test hoặc build.
10. Cập nhật phần **Current state** của tài liệu này nếu kiến trúc thực tế thay đổi đáng kể.

### Khi làm recommendation

Agent phải đọc thêm `system_prompt.md` và tuân thủ:

- hard filter chạy trước LLM;
- LLM chỉ nhận ứng viên đã lọc;
- output LLM phải được validate;
- candidate ID không nằm trong input phải bị từ chối;
- luôn có fallback không phụ thuộc LLM.

### Khi người dùng muốn tự code

- Chỉ hướng dẫn và đưa code trong chat.
- Không tạo/sửa file nếu người dùng chưa yêu cầu rõ ràng.
- Có thể đọc file và chạy lệnh chẩn đoán không thay đổi dữ liệu.
- Chỉ thực hiện thay đổi khi người dùng dùng yêu cầu trực tiếp như “sửa”, “tạo file” hoặc “implement”.

---

## 16. Thứ tự đọc code đề xuất

Đối với codebase hiện tại:

1. `backend/package.json` — hiểu lệnh và dependency.
2. `backend/tsconfig.json` — hiểu môi trường compile.
3. `backend/src/server.ts` — hiểu process khởi động.
4. `backend/src/app.ts` — hiểu composition root.
5. `backend/src/modules/health/health.route.ts` — xem module mẫu đầu tiên.
6. `docs/PROJECT_MODULES.md` — xem roadmap.
7. `docs/system_prompt.md` — chỉ cần khi làm LLM recommendation.

---

## 17. Cách cập nhật tài liệu

Cập nhật `ARCHITECTURE.md` khi có một trong các thay đổi:

- thêm/xóa module chính;
- thay đổi luồng request;
- thay ORM, framework hoặc external provider;
- thay đổi quy tắc phụ thuộc;
- thêm database, queue, cache hoặc background worker;
- thay đổi safety boundary của recommendation.

Không cần cập nhật tài liệu cho thay đổi nhỏ chỉ sửa implementation mà không ảnh hưởng kiến trúc.

**Last updated:** 2026-09-16  
**Current implementation milestone:** M01 hoàn thành; DB01 và DB02 database foundation hoàn thành.
