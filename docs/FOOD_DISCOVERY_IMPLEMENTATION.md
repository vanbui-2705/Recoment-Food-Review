# Taste Profile, Food Knowledge & Daily Discovery

## Phạm vi đã triển khai

Mục 3.2 và 3.3 của product plan được nối với giao diện thật và PostgreSQL. Trang đầu sau đăng nhập là gợi ý hôm nay. Hồ sơ lưu vị trí, khu vực, bữa ăn, ngân sách, khoảng cách, bốn mức khẩu vị, dị ứng kèm mức độ/ghi chú, chế độ ăn và cuisine. Món thích/không thích được lưu riêng theo ID món chuẩn để các tên gọi khác dùng chung lịch sử.

Frontend thực tế chạy từ `src/FoodApp.jsx`. `src/App.jsx` và `public/stitch` là các bản thiết kế cũ, không nằm trong entry point. Luồng thật không sử dụng danh sách quán mẫu, thông tin thời tiết giả, tự đặt đơn hay tuyên bố an toàn tuyệt đối.

## Quy tắc gợi ý và lịch sử

- `CHOSEN` và `EATEN` đều loại món khỏi gợi ý trong **96 giờ liên tục** từ thời điểm ghi nhận. Ví dụ chọn lúc 12:00 ngày 05/10 thì có thể gợi ý lại từ 12:00 ngày 09/10. Một lần chọn/ăn mới đặt lại khoảng chờ. `VIEWED`/`LIKED` không tạo khoảng chờ.
- Lịch sử nằm trong `user_interactions`, không phụ thuộc localStorage. Đổi máy vẫn dùng cùng lịch sử khi đăng nhập đúng tài khoản.
- Ghi “đã ăn hôm qua” gửi mốc 12:00 hôm qua theo múi giờ trình duyệt. API cũng hỗ trợ thời gian chính xác qua `eatenAt`; chỉ nhận thời điểm trong 30 ngày vừa qua và không nhận tương lai.
- UUID thao tác là idempotency key, được server ghép với user ID. Gửi lại cùng thao tác không ghi thêm lịch sử; dùng key đó cho món/loại thao tác/thời gian khác trả `409`.
- `DISLIKED` loại món vô thời hạn cho đến khi xóa preference. `LIKED` cộng điểm, không vượt hard filter.
- Toàn bộ khoảng giá công thức phải nằm trong ngân sách. Đây là **giá tham khảo**, không phải giá thực đơn của quán. Bữa ăn được lọc khi món có metadata bữa ăn; món chưa có metadata có thể xuất hiện và cần được biên tập bổ sung.
- Ranking deterministic dùng chênh lệch cay/ngọt/chua/mặn, cuisine và preference. Không cần LLM. Xét tối đa 500 món trong ngân sách, trả tối đa 20; trả `candidateLimitReached` nếu ngân hàng vượt giới hạn, UI thông báo rõ. Catalog tìm kiếm có phân trang tối đa 100 món/trang.
- Không tự bỏ điều kiện khi hết kết quả. Trả `ONBOARDING_REQUIRED`, `NO_MATCH` hoặc `INSUFFICIENT_SAFETY_DATA` để UI đưa ra hành động tiếp theo.

## Kiến thức và nguồn dữ liệu

Ngân hàng món là dữ liệu nội bộ có ID/slug, alias chuẩn hóa tiếng Việt, nguyên liệu, dị nguyên (`CONTAINS`/`MAY_CONTAIN`), cuisine, khoảng giá, bốn vị, bữa ăn, dietary codes, trạng thái xác minh và `evidenceSource`. ADMIN tạo/cập nhật full replacement trong transaction; mã nguyên liệu/cuisine/dietary/allergen không tồn tại bị từ chối trước khi thay đổi dữ liệu. Alias trùng sau chuẩn hóa và khoảng giá đảo ngược bị từ chối. Slug trùng trả `409`.

Development seed có 5 công thức Việt và quán mẫu phục vụ database tests. Giá/khẩu vị trong seed là ước tính, không phải bảng giá nhà hàng. Seed không ghi đè món đã `VERIFIED` hoặc có nguồn biên tập khác. Khi `NODE_ENV=production`, seed chỉ khởi tạo catalog chuẩn và ADMIN nếu được cấu hình rõ ràng; **không tạo quán/công thức development**. Production cần nhập ngân hàng món qua ADMIN API hoặc adapter merchant có hợp đồng dữ liệu; ngân hàng rỗng hiển thị trạng thái không có kết quả.

### Dị ứng và chế độ ăn

Schema hiện tại chỉ lưu hiện diện dị nguyên, chưa có bằng chứng vắng mặt dị nguyên tại từng quán hoặc quy trình chống nhiễm chéo. Vì vậy **hồ sơ có bất kỳ dị ứng nào chưa được tự động gợi ý món an toàn**; trả `INSUFFICIENT_SAFETY_DATA`. Người dùng vẫn có thể tra cứu kiến thức và xác nhận trực tiếp với quán. Không dùng thiếu mapping dị nguyên làm bằng chứng an toàn và không dùng Google rating hoặc AI để xác minh dị ứng.

Dietary bắt buộc chỉ nhận công thức `VERIFIED`, có nguồn và chứa code phù hợp. Đây là xác minh kiến thức công thức, không phải chứng nhận quán; UI luôn nhắc xác nhận cách chế biến thực tế. Để mở rộng gợi ý an toàn cho người dị ứng cần thêm dữ liệu thực đơn/ingredient/cross-contact có bằng chứng theo từng merchant. Đây là giới hạn dữ liệu thực tế, không được giải quyết bằng suy đoán.

## Google Places

Backend gọi Places API (New) Text Search theo tên món và tọa độ đã lưu; key không đi qua frontend. Request có field mask cụ thể, giới hạn 10 kết quả, timeout 6 giây, rate limit 10 lần/phút/IP/process. Location bias của Google không phải hard filter: backend tính khoảng cách Haversine và loại quán ngoài bán kính, quán không hoạt động. Khoảng cách là đường chim bay, không phải quãng đường hoặc thời gian giao hàng.

Kết quả chứa tên quán, địa chỉ, khoảng cách, rating/count, giờ mở cửa nếu có, Google Maps link, attribution và timestamp. Giá món là `null`, `menuConfirmed=false`. Text Search tìm quán liên quan, **không cung cấp cam kết quán có bán món hoặc thực đơn/giá/dị ứng đã xác minh**. Có thể bổ sung adapter merchant khác sau này; chưa triển khai một API thực đơn ngoài Google.

Không lưu/cache dữ liệu Google Places vào ngân hàng món hoặc các quán seed. Response có `Cache-Control: private, no-store`; UI hiện nguồn Google Maps và attribution nhà cung cấp. Khi thiếu key/timeout/upstream error trả `503` có mã lỗi rõ, không fallback quán giả.

Tài liệu chính thức: [Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [field masks](https://developers.google.com/maps/documentation/places/web-service/choose-fields), [policies và attribution](https://developers.google.com/maps/documentation/places/web-service/policies). Google API key cần project billing và Places API (New), giới hạn key cho API/backend IP phù hợp. Quota/budget và rate limit phân tán cần được cấu hình tại hạ tầng khi chạy nhiều replica.

## API

Mọi endpoint dưới đây yêu cầu Bearer access token; route `/admin/*` yêu cầu ADMIN.

| Method | Path | Chức năng |
|---|---|---|
| GET | `/users/me/profile` | Hồ sơ hiện tại |
| PUT | `/users/me/profile` | Thay toàn bộ hồ sơ, giữ onboarding đã hoàn tất |
| POST | `/users/me/onboarding` | Lưu hồ sơ và hoàn tất onboarding |
| GET | `/catalogs/allergens`, `/catalogs/cuisines`, `/catalogs/dietary-restrictions` | Catalog cho onboarding |
| GET | `/catalogs/ingredients` | Nguyên liệu (tối đa 1000) |
| PUT | `/admin/ingredients/:code` | Upsert nguyên liệu `{name, description}` |
| GET | `/dishes?q=pho&page=1&limit=20` | Tìm tên/alias, phân trang |
| GET | `/dishes/:id` | Chi tiết kiến thức món |
| POST | `/admin/dishes` | Tạo món có nguồn |
| PUT | `/admin/dishes/:id` | Thay toàn bộ thông tin và mapping món |
| PUT | `/users/me/dishes/:id/preference` | `{preference: "LIKED"/"DISLIKED"/null}` |
| GET | `/users/me/dish-preferences` | Món thích/không thích, tối đa 500 |
| GET | `/recommendations/today` | Gợi ý tự động theo hồ sơ và lịch sử |
| POST | `/users/me/dishes/:id/interactions` | Ghi nhận chọn/đã ăn |
| GET | `/users/me/food-history` | 100 thao tác gần nhất của tài khoản |
| GET | `/dishes/:id/restaurants` | Tìm quán trực tiếp từ Google Places |

Ví dụ ADMIN tạo món (catalog codes phải đã tồn tại):

```json
{
  "slug": "pho-bo", "name": "Phở bò", "description": "Mô tả công thức từ nguồn biên tập",
  "cuisineCode": "VIETNAMESE", "priceMin": 40000, "priceMax": 90000,
  "spicyLevel": 15, "sweetLevel": 25, "sourLevel": 10, "saltyLevel": 55,
  "verificationStatus": "REVIEWED", "evidenceSource": "Nguồn công thức và ngày biên tập thực tế",
  "dietaryCodes": [], "mealPeriods": ["BREAKFAST", "LUNCH"],
  "aliases": ["Beef pho"], "ingredientCodes": ["RICE_NOODLE", "BEEF", "FISH_SAUCE"],
  "allergens": [{"code": "FISH", "presence": "CONTAINS"}]
}
```

Ghi món ăn hôm qua:

```json
{"type":"EATEN","idempotencyKey":"cc8c23c5-fbdc-449c-a11b-5a32c9634b38","eatenAt":"2026-10-04T05:00:00.000Z"}
```

## Chạy và kiểm tra

Local: PostgreSQL → `backend/npm run db:migrate:deploy` → `npm run db:seed` → `npm run dev`. Frontend: `npm ci` → `npm run dev`; Vite proxy `/api` sang backend port 3001. Khởi tạo tài khoản trực tiếp từ giao diện.

Production: cấu hình `JWT_ACCESS_SECRET`, `POSTGRES_PASSWORD`, ADMIN credentials tùy chọn và `GOOGLE_PLACES_API_KEY` ở môi trường Compose. `docker compose up --build -d` chạy backend và frontend Nginx tại port 8080, `/api` được proxy cùng origin. Đặt HTTPS/TLS reverse proxy ở phía trước để geolocation hoạt động trên domain thật. Không đưa Google key vào biến `VITE_*`. Trước khi phát hành cần điền thông tin đơn vị vận hành/liên hệ vào điều khoản và chính sách riêng tư theo triển khai thực tế.

Frontend tự refresh access token bằng refresh token cùng session, có loading/error/empty states, retry idempotent, layout điện thoại và desktop. Refresh token nằm trong sessionStorage; access token nằm trong localStorage theo auth contract hiện có. Production cần bảo vệ XSS và có thể nâng auth lên HttpOnly cookie trong change riêng.

```text
backend: npm run typecheck; npm run lint; npm test; npm run test:db; npm run build
frontend: npm run build; npx playwright install chromium; npm test; npm audit
```

Playwright có project mobile (390×844) và desktop (1280×900), kiểm tra tự tải gợi ý, chọn món và biến mất sau khi lưu, lỗi nguồn quán và giữ đầy đủ profile khi sửa. Nếu máy đã có Chromium phù hợp có thể đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE` để dùng executable đó. Database tests kiểm tra transaction/catalog/ADMIN, lịch sử giữa tài khoản, idempotency, mốc 96 giờ, món ăn hôm qua và safety fail-closed.

Kiểm tra thực hiện ngày 05/10/2026: 29 unit/integration tests, 46 database tests và 6 browser tests đã qua; migration, Prisma generate, typecheck, lint, frontend/backend production build và Docker image build đã qua. Nginx config đã kiểm tra bằng `nginx -t`. Luồng trình duyệt nối API thật đã xác nhận đăng ký, onboarding, nhận gợi ý, chọn món, reload và lịch sử bền vững; tài khoản smoke đã được dọn. Dependency audit không còn báo lỗ hổng sau cập nhật Fastify/Vite và override các dependency Prisma CLI được audit chỉ ra. Google Places được kiểm tra bằng mock transport, chưa gọi live vì chưa có key. Không triển khai lên server production trong phiên này.
