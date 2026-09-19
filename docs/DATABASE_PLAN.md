# Rec-Food — Database Implementation Plan

## 1. Mục tiêu

Xây dựng PostgreSQL database cho Rec-Food theo từng migration nhỏ, bắt đầu từ authentication và mở rộng dần sang taste profile, kho món ăn, nhà hàng và recommendation history.

Thiết kế ưu tiên:

- an toàn dữ liệu dị ứng;
- schema rõ ràng, dễ query và index;
- không over-engineer MVP;
- có thể bổ sung vector search, PostGIS và collaborative filtering sau này;
- migration có thể tái lập trên database mới mà không cần sửa SQL thủ công.

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Database | PostgreSQL |
| ORM và migration | Prisma |
| Primary key | UUID |
| Tên bảng/cột database | `snake_case` |
| Tên model/field Prisma | `PascalCase` / `camelCase` và dùng `@map`/`@@map` |
| Tiền tệ | Số nguyên VND |
| Thời gian | `TIMESTAMPTZ` |
| Flavor score | Số nguyên từ 0 đến 100 |
| Email | Trim + lowercase trước khi lưu |
| Dị ứng | Danh mục chuẩn hóa + hard filter |
| Embedding/pgvector | Chưa thêm trong MVP đầu tiên |
| Geospatial/PostGIS | Chưa thêm trong migration đầu |

### Database schema versioning policy

Dự án sử dụng **migration-first workflow** để quản lý phiên bản database schema.

Quy tắc bắt buộc:

- Mọi thay đổi schema phải được thể hiện bằng một migration có tên rõ ràng.
- Migration phải được commit cùng code sử dụng schema mới.
- Không sửa database production bằng SQL thủ công mà không có migration tương ứng.
- Không sửa nội dung migration đã được áp dụng ở môi trường dùng chung; phải tạo migration mới để sửa tiếp.
- Không dùng `prisma db push` làm quy trình cập nhật schema chính thức. Lệnh này chỉ được dùng với database thử nghiệm có thể xóa bỏ và không được thay thế migration.
- Development tạo migration bằng `prisma migrate dev --name <migration_name>`.
- CI/staging/production chỉ áp dụng migration đã commit bằng `prisma migrate deploy`.
- Mỗi migration phải được kiểm tra trên database mới và database đang ở phiên bản ngay trước nó.
- Thay đổi dữ liệu hiện hữu phải có data migration hoặc script versioned, có thể kiểm tra và truy vết.
- Không xóa/đổi tên cột đang được production sử dụng trong một bước duy nhất nếu có nguy cơ downtime; ưu tiên quy trình expand → migrate data → contract.

Thư mục `backend/prisma/migrations` là lịch sử phiên bản schema và không được thêm vào `.gitignore`.

## 3. Phạm vi triển khai

Database được chia thành năm giai đoạn:

```text
DB01 Authentication
  ↓
DB02 Taste Profile
  ↓
DB03 Dish Knowledge Base
  ↓
DB04 Restaurants & Places
  ↓
DB05 Recommendation History & Feedback
```

Không tạo toàn bộ schema trong một migration lớn. Mỗi giai đoạn phải có migration, seed và test riêng.

### Trạng thái triển khai

| Giai đoạn | Trạng thái | Migration/Ghi chú |
|---|---|---|
| DB01 Authentication | Hoàn thành | `20260916134059_init_auth` |
| DB02 Taste Profile | Hoàn thành | `20260916135938_add_taste_profile` |
| DB03 Dish Knowledge Base | Hoàn thành | `20260918090000_add_dish_knowledge_base` |
| DB04 Restaurants & Places | Hoàn thành | `20260918133000_add_restaurants_and_places` |
| DB05 Recommendation History | Hoàn thành | `20260918170000_add_recommendation_history_feedback` + rating fix |

---

## 4. DB01 — Authentication foundation

### Mục tiêu

Cung cấp dữ liệu nền cho module đăng ký, đăng nhập, refresh token, logout và phân quyền.

### Bảng `users`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | VARCHAR(255) | Unique, not null |
| `password_hash` | TEXT | Not null |
| `display_name` | VARCHAR(100) | Not null |
| `role` | Enum | `USER`, `ADMIN` |
| `status` | Enum | `ACTIVE`, `DISABLED` |
| `email_verified_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | Not null, default now |
| `updated_at` | TIMESTAMPTZ | Not null, auto-update |

### Bảng `refresh_tokens`

| Cột | Kiểu | Ràng buộc |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK → `users.id` |
| `token_hash` | TEXT | Unique, not null |
| `expires_at` | TIMESTAMPTZ | Not null |
| `revoked_at` | TIMESTAMPTZ | Nullable |
| `replaced_by_token_id` | UUID | Nullable, self-reference |
| `last_used_at` | TIMESTAMPTZ | Nullable |
| `user_agent` | TEXT | Nullable |
| `ip_address` | INET hoặc TEXT | Nullable |
| `created_at` | TIMESTAMPTZ | Not null, default now |

### Index

```text
users(email) UNIQUE
refresh_tokens(token_hash) UNIQUE
refresh_tokens(user_id, expires_at)
```

### Quy tắc

- Không lưu password hoặc refresh token dạng plain text.
- Email phải được chuẩn hóa trước khi repository lưu hoặc tìm kiếm.
- Xóa user phải xóa refresh tokens liên quan bằng cascade.
- Token hết hạn không nhất thiết xóa ngay; có thể cleanup theo job sau này.

### Definition of Done

- PostgreSQL chạy local bằng Docker Compose.
- Prisma kết nối được qua `DATABASE_URL`.
- Migration chạy thành công trên database rỗng.
- Seed tạo được một user development mà không lưu mật khẩu gốc.
- Unique email và foreign key hoạt động.
- Prisma Client được đóng khi application shutdown.

---

## 5. DB02 — Taste Profile và hard constraints

### Các bảng

```text
taste_profiles
allergens
user_allergies
dietary_restrictions
user_dietary_restrictions
cuisines
user_cuisine_preferences
```

### `taste_profiles`

Quan hệ một-một với `users`.

| Cột | Kiểu |
|---|---|
| `id` | UUID |
| `user_id` | UUID, unique FK |
| `spicy_level` | SMALLINT, 0–100 |
| `sweet_level` | SMALLINT, 0–100 |
| `sour_level` | SMALLINT, 0–100 |
| `salty_level` | SMALLINT, 0–100 |
| `budget_min` | INTEGER |
| `budget_max` | INTEGER |
| `max_distance_meters` | INTEGER |
| `onboarding_completed` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### Dị ứng

`allergens` là danh mục chuẩn hóa, ví dụ:

```text
PEANUT
TREE_NUT
SHELLFISH
FISH
MILK
EGG
SOY
WHEAT_GLUTEN
SESAME
```

`user_allergies` dùng primary key kết hợp `(user_id, allergen_id)` và có thể lưu `severity`, `notes`.

Mọi bản ghi trong `user_allergies` đều là hard constraint; severity không được dùng để cho phép ứng viên vi phạm.

### Chế độ ăn

`dietary_restrictions` là danh mục chuẩn hóa. Bảng nối `user_dietary_restrictions` có `is_mandatory`:

- `true`: hard filter;
- `false`: preference mềm cho ranking.

### Cuisine preference

`user_cuisine_preferences.preference_score` nằm trong khoảng `-100..100`.

### Definition of Done

- Có check constraint cho flavor, budget và distance.
- Một user chỉ có một taste profile.
- Không thể thêm trùng một allergen/diet/cuisine cho cùng user.
- Seed có danh mục allergen, diet và cuisine tối thiểu.

---

## 6. DB03 — Dish Knowledge Base

### Các bảng

```text
dishes
dish_aliases
ingredients
dish_ingredients
dish_allergens
user_dish_preferences
```

### Nguyên tắc

- `dishes` lưu tên chuẩn, cuisine, khoảng giá và trạng thái xác minh.
- `dish_aliases` hỗ trợ tìm cùng món bằng nhiều tên.
- `ingredients` là danh mục nguyên liệu chuẩn hóa.
- `dish_allergens` lưu nguồn bằng chứng và trạng thái xác minh.
- `user_dish_preferences` chỉ lưu thích/ghét; không lưu dị ứng.

### Trạng thái xác minh

```text
UNVERIFIED
REVIEWED
VERIFIED
```

### `dish_allergens`

Các trường bắt buộc:

```text
dish_id
allergen_id
presence              CONTAINS | MAY_CONTAIN
verification_status
evidence_source
verified_at
created_at
```

Primary key kết hợp `(dish_id, allergen_id)`.

### Definition of Done

- Import seed chạy lại không tạo dữ liệu trùng.
- Tìm món theo tên chuẩn hoặc alias.
- Mỗi mapping dị nguyên có nguồn và trạng thái xác minh.
- Có seed ban đầu cho món Việt, nhưng không bắt buộc đủ 100–200 món trong migration đầu của giai đoạn này.

---

## 7. DB04 — Restaurants và Places

### Các bảng

```text
restaurants
restaurant_dishes
```

### `restaurants`

Lưu internal UUID và external provider ID riêng biệt:

```text
id
google_place_id
name
address
latitude
longitude
rating
rating_count
price_level
business_status
places_data_updated_at
created_at
updated_at
```

`google_place_id` là unique nhưng có thể nullable với dữ liệu nhập thủ công.

### `restaurant_dishes`

Map món với quán, gồm:

```text
restaurant_id
dish_id
price
is_available
source
verified_at
created_at
updated_at
```

Primary key `(restaurant_id, dish_id)`.

### Definition of Done

- Upsert dữ liệu Places không tạo quán trùng.
- Dữ liệu rating có timestamp cache.
- Giá là số nguyên VND.
- Chưa cần PostGIS; khoảng cách có thể lấy từ Places hoặc tính ở service trong MVP.

---

## 8. DB05 — Recommendation history và feedback

### Các bảng

```text
recommendation_requests
recommendation_results
user_interactions
```

### `recommendation_requests`

Lưu context của request:

```text
user_id
requested_at
latitude
longitude
meal_period
weather
budget_min
budget_max
max_distance_meters
natural_language_request
status
```

Status:

```text
SUCCESS
NO_MATCH
NO_SAFE_MATCH
INSUFFICIENT_DATA
FAILED
```

### `recommendation_results`

Lưu dish/restaurant, rank, base score, final score, reason và safety warnings. Không lưu chain-of-thought hoặc secret prompt data.

### `user_interactions`

Interaction types:

```text
VIEWED
LIKED
SKIPPED
CHOSEN
EATEN
RATED
```

Feedback cần `idempotency_key` để một event không bị tính hai lần.

### Definition of Done

- Lấy được lịch sử recommendation theo user và thời gian.
- Rank trong một request không trùng.
- Rating chỉ nhận 1–5.
- Feedback idempotent.
- Feedback không tự cập nhật danh sách dị ứng.

---

## 9. Index plan

```text
users(email) UNIQUE
refresh_tokens(token_hash) UNIQUE
refresh_tokens(user_id, expires_at)
user_allergies(user_id)
user_dietary_restrictions(user_id)
dishes(slug) UNIQUE
dish_aliases(normalized_alias)
dish_allergens(dish_id, allergen_id)
restaurants(google_place_id) UNIQUE
restaurant_dishes(dish_id)
restaurant_dishes(restaurant_id)
recommendation_requests(user_id, requested_at DESC)
recommendation_results(request_id, rank)
user_interactions(user_id, created_at DESC)
```

Chỉ thêm index khi phục vụ query thực tế. Không index mọi cột.

## 10. Seed plan

Seed phải idempotent bằng `upsert` hoặc unique key ổn định.

Thứ tự seed:

1. roles/status dùng enum trong schema;
2. allergens;
3. dietary restrictions;
4. cuisines;
5. development admin/user nếu cần;
6. ingredients;
7. dishes và aliases;
8. dish-allergen mappings;
9. restaurants và restaurant-dish mappings mẫu.

Không đưa production secret hoặc mật khẩu thật vào seed.

## 11. Test plan

Mỗi giai đoạn cần kiểm tra:

- migration chạy trên database rỗng;
- migration tạo đúng foreign key và unique constraint;
- seed chạy hai lần không tạo trùng;
- repository CRUD cơ bản;
- transaction rollback khi một bước thất bại;
- cascade/restrict behavior đúng thiết kế;
- dữ liệu vi phạm check constraint bị từ chối.

Riêng dữ liệu safety phải có test:

- user allergy không bị lưu trùng;
- dish-allergen mapping không bị lưu trùng;
- hard filter đọc được đầy đủ allergy relations;
- dữ liệu chưa xác minh giữ nguyên trạng thái, không bị hiểu là an toàn.

## 12. Cấu trúc file Prisma mục tiêu

```text
backend/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   └── plugins/
│       └── database.plugin.ts
├── compose.yaml
└── .env.example
```

Khi schema lớn, chỉ tách nhiều file nếu phiên bản Prisma và quy trình build đang dùng hỗ trợ ổn định; ban đầu ưu tiên một `schema.prisma` dễ theo dõi.

## 13. DB01 implementation record

DB01 đã hoàn thành các bước:

1. Tạo `backend/compose.yaml` cho PostgreSQL 17 local.
2. Thêm `DATABASE_URL` vào `.env.example` và `.env` local.
3. Cài Prisma ORM 7, PostgreSQL driver adapter và Prisma Client.
4. Tạo `prisma/schema.prisma`.
5. Tạo enum `UserRole`, `UserStatus`.
6. Tạo model `User`, `RefreshToken`.
7. Tạo và apply migration `20260916134059_init_auth`.
8. Tạo database plugin gắn với Fastify lifecycle.
9. Tạo seed development admin bằng Argon2id hash.
10. Tạo database integration tests cho kết nối và unique email.

## 14. DB02 implementation record

DB02 đã hoàn thành các bước:

1. Thêm `TasteProfile` và quan hệ một-một với `User`.
2. Thêm catalog `Allergen`, `DietaryRestriction`, `Cuisine` với code unique.
3. Thêm các bảng nối `UserAllergy`, `UserDietaryRestriction`, `UserCuisinePreference` bằng composite primary key.
4. Thêm enum `AllergySeverity`; mọi allergy vẫn là hard constraint bất kể severity.
5. Tạo và apply migration `20260916135938_add_taste_profile`.
6. Thêm check constraint cho flavor score, budget, distance và cuisine preference score.
7. Mở rộng seed idempotent với 9 allergens, 5 dietary restrictions và 10 cuisines.
8. Thêm database integration tests cho unique, check constraint, relation và cascade.
9. Ghi lại DB01 và DB02 bằng OpenSpec để proposal, spec, design và checklist có thể truy vết.

## 15. DB03 implementation record

DB03 đã hoàn thành các bước:

1. Thêm `Dish` với slug unique, cuisine, khoảng giá, flavor scores và trạng thái xác minh.
2. Thêm `DishAlias`, `Ingredient`, `DishIngredient`, `DishAllergen` và `UserDishPreference` với composite keys phù hợp.
3. Tạo và apply migration `20260918090000_add_dish_knowledge_base`.
4. Thêm check constraint cho khoảng giá, flavor scores, nguồn bằng chứng dị nguyên và timestamp của mapping đã xác minh.
5. Thêm index cho cuisine, normalized alias và chiều ngược của các bảng nối.
6. Mở rộng seed idempotent với 14 nguyên liệu, 5 món Việt, 10 alias, 22 mapping nguyên liệu và 7 mapping dị nguyên có nguồn/trạng thái.
7. Thêm database integration tests cho constraint, lookup theo slug/alias, unique mapping, allergen evidence, preference và cascade/restrict.
8. Xác nhận seed chạy lặp lại không đổi row counts và toàn bộ 15 database integration tests pass.

## 16. DB04 implementation record

DB04 đã hoàn thành các bước:

1. Thêm `Restaurant` với internal UUID, Google Place ID nullable/unique và metadata địa điểm có timestamp cache.
2. Thêm `RestaurantDish` với composite primary key, giá VND, availability, source và verification timestamp.
3. Tạo và apply migration `20260918133000_add_restaurants_and_places`.
4. Thêm check constraint cho tọa độ, rating, rating count, price level, menu price và nguồn dữ liệu.
5. Mở rộng seed idempotent với 3 restaurant và 5 restaurant-dish mappings.
6. Thêm database integration tests cho provider upsert, manual restaurant, constraint, unique mapping và cascade/restrict.
7. Xác nhận migration/seed trên database hiện tại và database trống; toàn bộ 23 database tests pass.

## 17. DB05 implementation record

DB05 đã hoàn thành các bước:

1. Thêm `RecommendationRequest` để lưu user, thời gian, location, meal/weather, budget/distance snapshot, yêu cầu tự nhiên và status.
2. Thêm `RecommendationResult` với rank unique trong request, score, lý do hiển thị và safety warnings dạng JSONB.
3. Thêm `UserInteraction` với interaction type, rating và idempotency key unique.
4. Tạo và apply migration `20260918170000_add_recommendation_history_feedback`.
5. Thêm migration sửa tiếp `20260918172000_enforce_rated_interaction_rating` để PostgreSQL bắt buộc `RATED` phải có rating 1–5.
6. Thêm index lịch sử theo user/thời gian và index cho các foreign key truy vấn ngược.
7. Áp dụng cascade cho dữ liệu thuộc user/request và restrict cho dish/restaurant được history tham chiếu.
8. Không tạo cột lưu chain-of-thought, secret prompt, credential hoặc raw private model reasoning.
9. Xác nhận toàn bộ 6 migrations và seed chạy được trên database trống; 35 database integration tests pass.

## 18. Ngoài phạm vi hiện tại

- pgvector và embedding;
- PostGIS;
- collaborative filtering;
- group recommendation;
- payment;
- notification;
- chat history dài hạn;
- lưu toàn bộ raw prompt/response của LLM.

**Status:** DB01 đến DB05 implemented and verified — database plan hoàn thành

**Next milestone:** Repository/service/API implementation trên schema đã hoàn thành

**Last updated:** 2026-09-18
