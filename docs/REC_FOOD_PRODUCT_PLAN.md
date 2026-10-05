# Rec-Food — Product Plan & Modular Roadmap

## 1. Tầm nhìn sản phẩm

Rec-Food là nền tảng khám phá món ăn cá nhân hóa kết hợp:

- hồ sơ khẩu vị và sở thích người dùng;
- gợi ý món ăn bằng AI;
- tìm nhà hàng trên Google Maps;
- rating và đánh giá;
- trợ lý AI hội thoại;
- giỏ hàng và đặt món sau khi người dùng xác nhận.

Mục tiêu cuối cùng là người dùng chỉ cần trò chuyện với trợ lý AI, nhận được gợi ý phù hợp và có thể xác nhận để tạo đơn hàng.

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

Trạng thái: đã triển khai API và onboarding thật, gồm vị trí, bữa ăn, ngân sách, khoảng cách, bốn vị và các catalog constraint. Món thích/không thích được lưu theo ID món. Xem [implementation và giới hạn dữ liệu](FOOD_DISCOVERY_IMPLEMENTATION.md).

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

### 3.5. Recommendation Engine

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

### Phase 4 — Cart & Ordering

- giỏ hàng;
- báo giá;
- xác nhận đơn;
- adapter cho từng nền tảng/nhà hàng;
- trạng thái đơn;
- thanh toán;
- giao hàng.

## 6. Thứ tự module nên xây tiếp

```text
1. taste-profile-api-and-onboarding
2. food-catalog-api
3. recommendation-engine-mvp
4. restaurant-places-integration
5. ai-food-assistant
6. cart-and-order-flow
7. payment-and-delivery-integration
8. admin-content-management
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
- cart/order;
- payment/delivery;
- admin UI/API đầy đủ.

## 9. Change tiếp theo đề xuất

Change tiếp theo nên là:

```text
taste-profile-api-and-onboarding
```

Taste profile và daily discovery đã triển khai. Bước tiếp theo là tích hợp nguồn thực đơn merchant và xác minh dữ liệu theo quán để mở rộng gợi ý cho hồ sơ có dị ứng; không dùng Google Text Search thay bằng chứng thực đơn hoặc an toàn.
