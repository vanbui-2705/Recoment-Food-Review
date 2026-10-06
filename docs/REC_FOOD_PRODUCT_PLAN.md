# Rec-Food — Product Plan & Modular Roadmap

## 1. Tầm nhìn sản phẩm

Rec-Food là nền tảng khám phá món ăn cá nhân hóa kết hợp:

- hồ sơ khẩu vị và sở thích người dùng;
- gợi ý món ăn bằng AI;
- tìm nhà hàng trên Google Maps;
- rating và đánh giá;
- trợ lý AI hội thoại;
- giỏ hàng và đặt món sau khi người dùng xác nhận.

Mục tiêu bản phát hành hiện tại là người dùng trò chuyện với trợ lý AI, nhận gợi ý món/quán phù hợp và xem hướng dẫn nấu hoặc chỉ đường. Giỏ hàng/đơn hàng (nhóm 9 trong bản rà soát) và thanh toán/giao hàng (nhóm 10) giữ **Coming soon**. Kiến trúc giao dịch dưới đây là định hướng tương lai, không thuộc phạm vi triển khai đợt này.

Kế hoạch thực hiện chi tiết: [REC_FOOD_COMPLETION_PLAN.md](REC_FOOD_COMPLETION_PLAN.md). Bộ proposal/design/specs/checklist: [complete-food-discovery-platform](../openspec/changes/complete-food-discovery-platform/proposal.md).

## 2. Kiến trúc tổng thể

```text
Web App
  │
  ├── Onboarding sở thích
  ├── Trang gợi ý món ăn
  ├── Chat với trợ lý AI
  ├── Chi tiết món + bản đồ + đánh giá
  ├── Giỏ hàng
  └── Xác nhận đặt món
          │
          ▼
Fastify Backend
  ├── Auth & Users
  ├── Taste Profile
  ├── Food Knowledge Base
  ├── Places & Restaurant
  ├── Recommendation Engine
  ├── AI Assistant
  ├── Cart & Order
  ├── Payment/Delivery Adapter
  ├── Feedback & History
  └── Admin
          │
          ├── PostgreSQL
          ├── Google Places/Maps
          ├── LLM Provider
          └── Merchant/Food Delivery API
```

Nên bắt đầu bằng modular monolith: một backend Fastify, PostgreSQL và frontend React. Khi hệ thống lớn hơn mới tách recommendation, chat hoặc order thành worker/service riêng.

## 3. Các module nghiệp vụ

### 3.1. Auth & Users

Chức năng:

- đăng ký, đăng nhập;
- JWT access token;
- refresh token;
- logout;
- đổi mật khẩu;
- phân quyền USER/ADMIN;
- rate limit.

Trạng thái: đã triển khai phần core.

### 3.2. Taste Profile & Onboarding

Người dùng nhập:

- khu vực/vị trí hiện tại;
- món yêu thích;
- món không thích;
- khẩu vị cay/ngọt/chua/mặn;
- dị ứng;
- chế độ ăn: chay, vegan, halal…;
- ngân sách;
- khoảng cách tối đa;
- thời điểm ăn: sáng/trưa/tối.

API dự kiến:

```text
GET  /users/me/profile
PUT  /users/me/profile
POST /users/me/onboarding
GET  /catalogs/allergens
GET  /catalogs/cuisines
GET  /catalogs/dietary-restrictions
```

Trạng thái: màn hình “Khẩu vị của tôi” giữ một ô mô tả tự do. Đã bổ sung job/worker Gemini structured extraction, kiểm tra revision/schema/catalog, trạng thái phân tích và review thông tin an toàn; áp dụng hồ sơ và analyzedRevision atomically. Cần LLM_API_KEY và worker bật để phân tích live; không dùng fake analysis khi thiếu key. Xem [luồng nhập khẩu vị](PERSONAL_FOOD_KNOWLEDGE.md) và [P0/P1 implementation](TASTE_ANALYSIS_IMPLEMENTATION.md).

### 3.3. Food Knowledge Base

Quản lý:

- món ăn;
- alias/tên gọi khác;
- nguyên liệu;
- dị ứng;
- cuisine;
- khoảng giá;
- độ cay/ngọt/chua/mặn;
- trạng thái xác minh;
- món người dùng thích/ghét.

Trạng thái: đã có API tìm kiếm/chi tiết món và ADMIN tạo/cập nhật kiến thức trong transaction, gồm nguồn, alias, ingredient, allergen, cuisine, giá tham khảo, bốn vị, dietary và bữa ăn. Google Places là nguồn tìm quán trực tiếp; không tự coi kết quả tìm quán là thực đơn món đã xác minh.

Trang chủ tự tải gợi ý hôm nay. Món đã chọn hoặc đã ăn bị loại trong đủ 96 giờ, kể cả món ghi nhận đã ăn hôm qua; lần chọn/ăn mới đặt lại thời gian chờ. Không tự nới bộ lọc khi hết món. Hồ sơ có dị ứng hiện trả thiếu dữ liệu an toàn vì chưa có bằng chứng theo từng quán. Chi tiết vận hành, API và test nằm trong [implementation](FOOD_DISCOVERY_IMPLEMENTATION.md).

Đã bổ sung nguồn công thức tự động từ TheMealDB và Spoonacular: tìm món, nguyên liệu, từng bước nấu, liên kết nguồn/video nếu có, chọn nấu hôm nay và ghi món đã ăn. Trang chủ tải ý tưởng nấu ăn khi vào app; lịch sử món bên ngoài dùng cùng thời gian chờ 96 giờ qua tên chuẩn hóa và alias đã biết. Công thức chưa có giá/khẩu vị xác minh được hiển thị là ý tưởng nấu tại nhà. Xem [cấu hình API và giới hạn](EXTERNAL_FOOD_APIS.md).

### 3.4. Restaurants & Google Places

Khi người dùng bấm vào món, hệ thống hiển thị:

- quán bán món đó;
- vị trí trên Google Maps;
- khoảng cách;
- rating;
- số lượt đánh giá;
- giá tham khảo;
- trạng thái mở/đóng;
- link chỉ đường.

Backend nên có Places adapter riêng:

```text
places/
  places.route.ts
  places.service.ts
  places.adapter.ts
  places.repository.ts
```

Frontend không gọi Google API trực tiếp để tránh lộ key và bypass business rules.

Đã có luồng nhập tên món/quán bất kỳ, không yêu cầu món có sẵn trong ngân hàng nội bộ, qua `GET /discovery/restaurants`. Kết nối Google Places, Goong, Foursquare Places hiện hành và Geoapify; chọn nguồn, bán kính, vị trí hiện tại/hồ sơ và chỉ quán xác nhận đang mở cửa. Kết quả giữ nguồn/attribution và phân biệt địa điểm liên quan từ khóa với nhà hàng gần vị trí. Chưa có bằng chứng thực đơn nên không khẳng định quán bán món hoặc bịa giá món. Frontend đã nối backend qua `/api`; toàn bộ key nằm trong `backend/.env`.

### 3.5. Recommendation Engine

Trang chính có luồng “Ăn ngon quanh bạn”: nhập ngân sách mỗi người, chọn bán kính 3–4 km và tìm quanh vị trí. Hiển thị ảnh từ quán, rating/số lượt đánh giá và giá món khi có thực đơn xác nhận. Quán chưa có giá món được tách riêng. Nút vòng quay ở góc màn hình chọn ngẫu nhiên từ các kết quả hiện tại; quay thử không ghi lịch sử, chỉ bấm chọn món mới kích hoạt thời gian chờ 96 giờ. Luồng này không phụ thuộc AI phân tích khẩu vị. Xem [hành vi và giới hạn nguồn dữ liệu](NEARBY_FOOD_AND_RANDOM.md).

Luồng gợi ý:

```text
User profile
    │
    ▼
Lấy món/quán ứng viên
    │
    ▼
Hard filter
- dị ứng
- chế độ ăn bắt buộc
- ngân sách
- khoảng cách
    │
    ▼
Base ranking
- khẩu vị
- món yêu thích
- lịch sử chọn
- rating
    │
    ▼
LLM re-ranking/explanation
    │
    ▼
Danh sách gợi ý
```

AI không được tự quyết định món có an toàn với dị ứng hay không. Hard filter phải chạy trước LLM.

API dự kiến:

```text
POST /recommendations
GET  /recommendations/:id
POST /recommendations/:id/feedback
POST /recommendations/:id/interactions
```

### 3.6. AI Assistant / Chat

Người dùng có thể nói:

> Tối nay tôi muốn ăn món Việt, ít cay, gần Quận 1, giá dưới 100 nghìn.

AI không truy cập trực tiếp database hoặc Google. AI chỉ được gọi các tool backend được kiểm soát:

```text
get_user_profile()
search_dishes()
search_restaurants()
get_restaurant_details()
get_recommendations()
create_cart()
get_order_quote()
submit_order_after_confirmation()
```

Trong bản phát hành hiện tại chỉ đăng ký tool khám phá/profile; ba tool giỏ hàng/báo giá/đặt đơn ở trên là **Coming soon**, không được expose cho AI. Yêu cầu đặt món/thanh toán được trả trạng thái chưa hỗ trợ và có thể chuyển sang xem quán/chỉ đường.

Luồng xác nhận đặt món:

```text
User chat
  │
  ▼
AI Assistant
  │
  ├── gọi tool tìm món
  ├── gọi tool tìm quán
  ├── giải thích lựa chọn
  └── hỏi lại nếu thiếu thông tin
```

AI bắt buộc phải xác nhận lại trước khi đặt hàng:

```text
AI: Bạn muốn đặt Phở bò tại quán A,
    giá dự kiến 65.000đ, giao đến địa chỉ X?

User: Đồng ý

AI: Tạo đơn hàng
```

Không cho phép AI tự gọi `submit_order` chỉ vì người dùng nói mơ hồ như “ok” trong ngữ cảnh không rõ.

### 3.7. Cart & Order

Trạng thái: **Coming soon** — nhóm 9; không xây schema/API giao dịch trong đợt hoàn thiện discovery. Thanh toán/giao hàng là **Coming soon** — nhóm 10. Phần thiết kế dưới đây được giữ cho giai đoạn tương lai.

Các bảng/module dự kiến:

```text
carts
cart_items
orders
order_items
order_status_history
delivery_addresses
```

Trạng thái đơn hàng:

```text
DRAFT
PENDING_CONFIRMATION
CONFIRMED
SUBMITTED
ACCEPTED
PREPARING
DELIVERING
COMPLETED
CANCELLED
FAILED
```

API dự kiến:

```text
GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id

POST   /orders/quote
POST   /orders/confirm
GET    /orders
GET    /orders/:id
POST   /orders/:id/cancel
```

Tự động đặt hàng chỉ khả thi khi có một trong các phương án:

1. Nhà hàng có API đặt món.
2. Nền tảng giao đồ ăn cung cấp API đối tác.
3. Hệ thống tạo deep link để người dùng hoàn tất thủ công.

Không nên dựa vào browser automation để đặt hàng production ngay từ đầu.

### 3.8. Feedback & Recommendation History

Lưu:

- món đã xem;
- món đã thích/ghét;
- món đã chọn;
- món đã ăn;
- rating;
- lịch sử câu hỏi;
- kết quả recommendation.

Dữ liệu này dùng để cải thiện ranking cá nhân hóa theo thời gian.

### 3.9. Admin & Content Management

Admin quản lý:

- món ăn;
- nguyên liệu;
- dị ứng;
- nhà hàng;
- dữ liệu xác minh;
- trạng thái món;
- báo cáo món sai;
- user bị khóa;
- audit log.

## 4. Cấu trúc frontend đề xuất

```text
frontend/src/
├── api/
├── components/
├── layouts/
├── routes/
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── taste-profile/
│   ├── recommendations/
│   ├── dish-details/
│   ├── restaurants/
│   ├── assistant-chat/
│   ├── cart/
│   ├── orders/
│   └── profile/
├── pages/
│   ├── LoginPage
│   ├── OnboardingPage
│   ├── HomePage
│   ├── RecommendationPage
│   ├── DishDetailPage
│   ├── ChatPage
│   ├── CartPage
│   └── OrdersPage
└── App.tsx
```

## 5. Roadmap triển khai

### Phase 1 — Discovery MVP

- onboarding;
- taste profile API;
- danh sách món;
- recommendation deterministic;
- restaurant detail;
- Google Maps link;
- feedback thích/ghét.

### Phase 2 — AI Recommendation

- LLM re-ranking;
- giải thích vì sao đề xuất món;
- chat chỉ để tìm kiếm/gợi ý;
- lưu lịch sử chat;
- tool calling an toàn.

### Phase 3 — Chat Assistant hoàn chỉnh

- chat streaming;
- hội thoại nhiều lượt;
- AI nhớ context hiện tại;
- AI hỏi lại ngân sách, vị trí, khẩu vị;
- tạo recommendation từ hội thoại.

### Phase 4 — Cart & Ordering — Coming soon

Đã hoãn khỏi phạm vi bản phát hành hiện tại, bao gồm thanh toán và giao hàng. Các phase đang thực hiện được thay bằng P0–P6 trong [kế hoạch hoàn thiện](REC_FOOD_COMPLETION_PLAN.md).

- giỏ hàng;
- báo giá;
- xác nhận đơn;
- adapter cho từng nền tảng/nhà hàng;
- trạng thái đơn;
- thanh toán;
- giao hàng.

## 6. Thứ tự module nên xây tiếp

```text
P0. baseline, hợp đồng API/config và Coming soon
P1. AI phân tích mô tả khẩu vị
P2. thực đơn merchant + safety evidence + chi tiết quán + admin ingest
P3. recommendation thống nhất + LLM ranking/explanation
P4. chat discovery nhiều lượt và streaming
P5. feedback + admin đầy đủ
P6. tài khoản/email + vận hành và release gates

Coming soon: cart/order và payment/delivery
```

## 7. Rủi ro và nguyên tắc an toàn

### AI hallucination

LLM chỉ được giải thích và xếp hạng các candidate do backend cung cấp. Không cho AI tự tạo món, quán, rating hoặc địa chỉ.

### Dị ứng và chế độ ăn

Hard filter phải chạy trước AI. Dữ liệu chưa xác minh không được coi là an toàn tuyệt đối.

### Dữ liệu Google Maps

Rating, giá và trạng thái nhà hàng có thể thay đổi. Cần lưu timestamp cache và hiển thị thời điểm cập nhật.

### Quyền riêng tư vị trí

Chỉ lưu vị trí cần thiết, giới hạn độ chính xác khi có thể và không log location nhạy cảm.

### Chi phí và độ trễ LLM

Recommendation deterministic phải hoạt động được khi LLM timeout. LLM chỉ xử lý top-N candidate thay vì toàn bộ database.

### Đặt hàng

Không xác nhận đơn hoặc thanh toán nếu chưa có hành động đồng ý rõ ràng từ người dùng.

## 8. Trạng thái codebase hiện tại

Đã có:

- backend Fastify;
- PostgreSQL và Prisma schema;
- authentication core;
- refresh token;
- phân quyền;
- taste profile/database foundation;
- dish, restaurant và recommendation-history database foundation.
- frontend onboarding, profile, gợi ý hôm nay, tra cứu món và lịch sử thật;
- food knowledge API và ADMIN write API có nguồn;
- Google Places Text Search adapter backend và link Maps.

Chưa có implementation hoàn chỉnh:

- nguồn thực đơn/giá món trực tiếp từ merchant;
- bằng chứng an toàn dị ứng theo từng quán;
- LLM integration;
- chat assistant;
- cart/order — Coming soon, ngoài scope đợt này;
- payment/delivery — Coming soon, ngoài scope đợt này;
- admin UI/API đầy đủ.

## 9. Change tiếp theo đề xuất

Change tiếp theo nên là:

```text
complete-food-discovery-platform
```

Taste profile và daily discovery đã triển khai. Change mới có proposal, design, chín capability specs và tasks theo P0–P6. Bắt đầu P0/P1; xây pipeline merchant/evidence và tài khoản/vận hành ở các nhánh độc lập tiếp theo. Nguồn merchant cần hợp đồng/key thật để đạt live-ready; không dùng Google Text Search thay bằng chứng thực đơn hoặc an toàn. Chi tiết API, UX, dữ liệu, test và điều kiện phát hành nằm trong [REC_FOOD_COMPLETION_PLAN.md](REC_FOOD_COMPLETION_PLAN.md).
