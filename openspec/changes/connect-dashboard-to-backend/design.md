## Context

Xem `proposal.md` phần Why. Backend Fastify hiện đã có auth/session, taste profile, recommendation/discovery, nearby food, chat streaming và interaction history. Dashboard mới chỉ dùng `GET /users/me`, `GET /users/me/profile` và logout; năm page còn lại chủ yếu chứa fixture và local state.

Ràng buộc cao nhất là bảo toàn giao diện đã chốt. “Không ảnh hưởng frontend” trong change này được hiểu là được sửa logic JavaScript/React để nối API nhưng không được tự ý sửa cách frontend nhìn thấy hoặc vận hành về mặt điều hướng. Nội dung thật như tên món, giá, quán và lịch sử được phép khác fixture; presentation shell không được đổi.

Working tree đang chứa redesign chưa commit và nhiều module frontend cũ bị xóa. Việc triển khai phải patch có mục tiêu trên redesign hiện tại, không restore/reset hoặc copy nguyên ứng dụng cũ.

## Goals / Non-Goals

**Goals:**

- Tạo đường biên API/view-model để các component hiện tại nhận dữ liệu thật mà không mang logic HTTP vào markup.
- Nối từng vertical slice nhỏ, có bằng chứng request/response thật và visual regression trước khi chuyển slice.
- Phân biệt rõ hạng mục có thể nối không đổi UI với hạng mục cần phê duyệt.
- Giữ backend là source of truth và loại bỏ false-success/fixture masquerading trong các slice đã hoàn tất.

**Non-Goals:**

- Không thiết kế lại, chỉnh CSS, thay class Tailwind, đổi asset, đổi navigation hay khôi phục frontend cũ hàng loạt.
- Không xây order/payment/delivery chỉ để làm các panel mock hiện tại hoạt động.
- Không sửa backend hoặc schema database trong luồng mặc định của change này.
- Không tuyên bố một page hoàn tất nếu chỉ happy path hoạt động nhưng error/empty/auth state vẫn giả.

## Decisions

### 0. Treat the dashboard as a complete product rebuild by vertical domain

Change được triển khai theo các domain độc lập: session/auth, discovery, nearby, chat, profile/account, interaction history và cuối cùng là commerce. Mỗi domain phải chạy end-to-end với backend thật; việc chỉ làm happy path hoặc giữ fixture runtime không được xem là hoàn thành.

Các domain đã có contract được nối vào presentation shell hiện tại trước. Các domain thiếu UI tương thích hoặc thiếu backend được tách thành checkpoint có thiết kế, contract và rollback riêng. Cách này giữ được giao diện đã chốt nhưng vẫn đưa toàn bộ sản phẩm tới trạng thái chạy thật thay vì để các control mock vô thời hạn.

Alternative considered: chỉ hoàn thiện các endpoint khớp sẵn và ghi phần còn lại là blocked. Loại bỏ vì không đạt mục tiêu build lại toàn bộ chức năng người dùng.

### 1. Freeze presentation before integration

Trước khi sửa logic, chụp baseline của năm route `#today`, `#chat`, `#map`, `#profile`, `#history` ở desktop 1280×900 và mobile 390×844 bằng dữ liệu deterministic. Đồng thời lưu DOM/layout invariants: không horizontal overflow, nav còn truy cập được, main content không bị che và các control chính vẫn ở cùng vùng.

Mỗi slice dùng cùng fixture ở visual test để so presentation trước/sau; test dữ liệu thật là bộ functional test riêng. Việc tách hai bộ test tránh coi thay đổi tên món hoặc giá thật là layout regression.

Alternative considered: chỉ review bằng mắt sau khi code. Loại bỏ vì không đủ bằng chứng để đảm bảo redesign không bị vỡ ở mobile.

### 2. Add an API and adapter boundary without changing markup

Giữ `profileApi.js` tương thích trong bước đầu, sau đó đặt các lời gọi mới sau một client dùng chung và adapter theo domain. Component chỉ nhận view-model và callback. Adapter chịu trách nhiệm nullable fields, đơn vị giá/khoảng cách, trạng thái provider và mapping ID; không bịa dữ liệu nghiệp vụ khi response thiếu.

State/hook có thể thêm vào component hoặc module mới, nhưng markup/className chỉ được thay ở mức lặp dữ liệu tương đương. Mọi thay đổi cấu trúc để thêm loading/error/empty control đi qua approval gate.

Alternative considered: phục hồi các component cũ đã nối API. Loại bỏ vì sẽ ghi đè redesign và gần như chắc chắn làm đổi layout.

### 3. Integrate only semantically compatible contracts

Ma trận audit ban đầu:

| Vùng UI hiện tại | Backend contract | Phân loại | Ghi chú |
|---|---|---|---|
| Header user | `GET /users/me` | Có thể nối, không đổi UI | Đã gọi API; cần bỏ fallback danh tính giả sau khi có failure handling được duyệt |
| Logout | `POST /auth/logout` | Có thể nối, không đổi UI | Đã có; cần test token/refresh cleanup |
| Dị ứng/budget/radius/profile | `GET/PUT /users/me/profile`, catalogs | Có thể nối một phần | Dị ứng và các field profile thật có thể map; “chef notes” không có contract tương đương |
| Discovery cards | `GET /recommendations/today`, `GET /recipes/today`, `POST /recommendations` | Có thể nối một phần | Chỉ map item có cùng semantics; missing image dùng fallback trung tính đã duyệt sẵn hoặc checkpoint |
| Like/chosen/eaten | dish/recipe interaction endpoints và recommendation feedback | Có thể nối | Phải dùng UUID idempotency và chống double-submit |
| Nearby/map list | `GET /discovery/nearby-food`, `GET /discovery/restaurants` | Có thể nối một phần | Dùng tọa độ/profile đã có; không tự bật browser permission prompt |
| Chat input/messages | conversations, messages, chat-run SSE | Có thể nối happy path | Reconnect/cancel/error controls chưa tồn tại trong redesign nên cần checkpoint nếu phải thêm UI |
| History cards | `GET /users/me/history` | Không tương thích semantics | Backend là interaction history; UI đang mô tả order/delivery/driver/payment |
| Re-order/live dispatcher | Không có order API/domain | Blocked | Không nối giả sang chat và không xây backend mới khi chưa duyệt |
| Weather/current GPS text | Không có weather API; location có thể lấy từ profile | Có thể nối một phần | Không gọi dịch vụ ngoài từ browser; geolocation prompt cần duyệt |
| Login/register/recovery | Backend auth API có, redesign không có auth screen | Cần duyệt UI | Không tự thêm modal/page/redirect |

Mỗi endpoint sẽ có contract test dùng payload thật từ backend schema hoặc test fixture đã khóa. Nếu route/schema thực tế không khớp giả định trong bảng, slice dừng và cập nhật kế hoạch trước khi code tiếp.

### 4. Use explicit approval gates

Hai loại thay đổi:

- **Auto-eligible:** chỉ thêm client/adapter/state/callback/test; giữ nguyên markup, className, label, control, navigation và screenshot deterministic đạt baseline. Các thay đổi này có thể triển khai sau audit mà không cần hỏi lại từng dòng.
- **Approval-required:** thêm/bớt/ẩn/disable control; đổi label/text cố định; thêm skeleton, empty/error/auth modal hoặc page; thay asset/style/layout; thay navigation; xin browser location; thay semantics; sửa backend/schema; hoặc diff screenshot vượt vùng dữ liệu động.

Tại approval gate phải cung cấp: vấn đề, API hiện có, lý do không thể giữ UI, mock/screenshot trước-sau, file dự kiến sửa, test tác động và phương án rollback. Không nhận duyệt thì hạng mục giữ trạng thái blocked, các slice độc lập khác vẫn tiếp tục.

### 5. Preserve honest failure semantics

Không dùng fixture làm fallback runtime sau khi một slice đã nối API. Mutation chỉ báo thành công sau response. Request có idempotency key được tạo một lần cho mỗi ý định người dùng và tái sử dụng khi retry cùng ý định.

Client refresh token chỉ điều phối một refresh đồng thời và retry request gốc tối đa một lần. Nếu không có session dùng được, vì redesign chưa có auth screen, đây là approval gate chứ không tự thêm UI.

### 6. Deliver in independently reversible slices

Thứ tự kỹ thuật:

1. Baseline và freeze tests.
2. API client/adapters/contract tests không nhìn thấy trên UI.
3. Header/session/logout và phần profile có contract tương thích.
4. Discovery/recommendation/interaction.
5. Nearby/map với vị trí từ profile, không bật permission prompt.
6. Chat conversations/send/SSE trong presentation hiện có.
7. History/order, auth UI, empty/error UI, geolocation và unsupported commerce chỉ sau approval riêng.

Mỗi slice là một diff nhỏ và có thể revert độc lập; không gộp nhiều page vào một lần thay đổi.

## Risks / Trade-offs

- **[UI hiện tại thiếu loading/error/empty states]** → Dùng approval gate; không che lỗi bằng fixture hoặc tự thêm UI.
- **[Nội dung thật dài/ngắn hơn fixture làm vỡ card]** → Contract fixture gồm chuỗi biên, kiểm tra desktop/mobile và dừng nếu cần truncate/layout change.
- **[History UI nói về đơn hàng nhưng backend chỉ lưu tương tác]** → Không map sai; để blocked cho đến khi người dùng chọn đổi UI hoặc mở scope backend order.
- **[Chat UI chứa live order dispatcher không có backend]** → Chỉ nối phần conversation tương thích và không đánh dấu toàn page hoàn tất; phần dispatcher cần quyết định riêng.
- **[Redesign chưa commit và có nhiều file deleted]** → Không reset/restore; chụp status trước mỗi slice và chỉ patch file đã liệt kê.
- **[External provider/LLM có thể chưa cấu hình]** → Test contract bằng fake provider và kiểm tra trạng thái runtime; không trình bày kết quả mock như live.
- **[Visual snapshot dễ nhiễu do dữ liệu/thời gian]** → Cố định clock, response, viewport, font và animation trong visual suite.

## Migration Plan

Thứ tự phát hành đầy đủ là: giữ baseline/profile hiện có; hoàn thiện discovery; nearby/map; chat; trình duyệt và triển khai auth UI; hoàn thiện account; duyệt và chuyển History sang interaction history; sau cùng mới mở change backend riêng cho commerce. Mỗi phase giữ image Docker trước đó để rollback độc lập.

1. Ghi lại git status, hash/metadata image Docker đang chạy và baseline visual/DOM cho năm route.
2. Thêm test harness và API boundary; chạy build/test trước khi chạm page.
3. Triển khai từng slice auto-eligible theo thứ tự đã quyết định; sau mỗi slice chạy contract, functional, visual và Docker smoke test qua `:8081`.
4. Nếu một test yêu cầu thay đổi presentation, tạo approval packet và dừng riêng slice đó.
5. Rebuild duy nhất frontend container cho slice đã đạt; giữ image trước làm rollback.
6. Smoke test với tài khoản test và log redacted; rollback image/diff của riêng slice nếu có regression.

Không có data migration trong phạm vi mặc định. Backend/schema change, nếu cần, phải là change riêng được duyệt.

## Open Questions

Không có câu hỏi nào được phép trì hoãn mà làm thay đổi task breakdown. Các quyết định về auth UI, history/order semantics, unsupported commerce, visible failure states và browser geolocation đã được biểu diễn thành approval gate bắt buộc thay vì giả định.
