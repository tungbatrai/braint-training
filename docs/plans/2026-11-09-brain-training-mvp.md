# Brain Training — Phân tích và kế hoạch MVP

Ngày lập: 09/11/2026. Trạng thái: đề xuất để duyệt, chưa triển khai mã nguồn.

## 1. Mục tiêu và phạm vi

Xây dựng một website chứa các mini app luyện tư duy, dùng chung tài khoản, lịch sử, tiến độ và trang quản trị. Brain Training là mini app đầu tiên; cấu trúc theo module để bổ sung bài tập mà không phải tạo lại hệ thống tài khoản. Chưa xây nền tảng chạy mã hoặc cài plugin của bên thứ ba.

MVP gồm đăng ký/đăng nhập, Dashboard, Mental Math, Memory Training, lịch sử, thử thách 14 ngày và admin. Logical Thinking, Focus Training triển khai ở đợt tiếp theo; chúng không ảnh hưởng tiêu chí hoàn thành ngày của MVP.

Nguồn yêu cầu: tài liệu người dùng đính kèm và yêu cầu bổ sung tài khoản, lưu dữ liệu lâu dài, admin và chuẩn bị đưa mã nguồn lên GitHub.

## 2. Phase 1 — Kết quả kiểm tra thực tế

| Hạng mục | Kết quả |
| --- | --- |
| Thư mục làm việc | `G:\learn` có 0 mục trước khi tạo tài liệu này |
| Repository | Không có `.git`; `git status --short` báo không phải Git repository |
| Frontend, backend, database | Chưa có mã nguồn, cấu hình hoặc migration |
| Authentication, component dùng lại | Chưa có |
| Công cụ trên PATH | Có Node, npm, Java 17, Docker CLI và Git; chưa tìm thấy Maven |
| Docker engine | Chưa kiểm tra trạng thái hoạt động |
| GitHub | Đã nhận diện tài khoản `tungbatrai`; API liệt kê repository trả về danh sách rỗng. Không kết luận tài khoản không có repository; có thể do phạm vi kết nối |
| Vercel | Liệt kê được hai dự án `code-ui-1ynm` và `tutorial`; chưa liên kết với Brain Training |
| Cloudflare | Kết nối trả lỗi yêu cầu xác thực lại; chưa kiểm tra được tài nguyên tài khoản |

Chưa đọc file nhạy cảm, tạo repository từ xa, sửa dự án cloud, commit, push, deploy hay đổi DNS.

## 3. Các phương án kiến trúc

### A — Giữ công nghệ ưu tiên của tài liệu (khuyến nghị mặc định)

- Frontend: React + TypeScript + Vite, Ant Design v5, React Router, TanStack Query, Axios.
- Backend: Java 17, Spring Boot 3, Spring Security, Spring Data JPA.
- Database: PostgreSQL; Flyway quản lý migration.
- Local: Maven Wrapper cho backend; Docker Compose cho PostgreSQL; npm cho frontend.
- GitHub chứa một repository với frontend, backend, tài liệu và cấu hình CI.
- Vercel triển khai frontend. Backend chạy trên dịch vụ container tương thích Spring Boot, database chạy trên PostgreSQL có lưu trữ bền vững và sao lưu riêng.
- Cloudflare có thể quản lý DNS khi gắn tên miền và Turnstile cho đăng ký/đăng nhập; không dùng thêm Worker chỉ để chuyển tiếp request.

Ưu điểm: sát yêu cầu ban đầu, business logic và transaction tập trung ở backend, phù hợp mở rộng. Đánh đổi: cần vận hành thêm dịch vụ backend và PostgreSQL ngoài frontend.

Không giả định Vercel là máy chủ Spring Boot chạy liên tục. Tài liệu Vercel hiện có Container runtime, nhưng nếu chọn hướng đó phải kiểm chứng Spring Boot, giới hạn runtime, gói tài khoản và kết nối database bằng một bản thử riêng trước khi thay thế mô hình container host độc lập.

### B — Ưu tiên hệ sinh thái Vercel + Cloudflare

- Giữ React/Vite trên Vercel.
- Backend TypeScript/Hono trên Cloudflare Workers.
- Cloudflare D1 lưu dữ liệu theo ngữ nghĩa SQLite; migration SQL thay Flyway/JPA.

Ưu điểm: dùng hai nhà cung cấp đã chọn cho frontend và backend/database, thống nhất TypeScript. Đánh đổi: thay Java/Spring Boot và PostgreSQL được ưu tiên trong tài liệu; phải thiết kế lại transaction và cơ chế khóa theo D1, kiểm chứng giới hạn thực tế. Không mặc định phương án này miễn phí hoặc có cùng đặc tính với PostgreSQL.

Kế hoạch chi tiết bên dưới dành cho phương án A. Chỉ chuyển sang B khi người dùng chọn rõ phương án đó.

## 4. Kiến trúc và cấu trúc dự kiến

```text
Trình duyệt → Frontend trên Vercel → /api/* → Spring Boot → PostgreSQL
                                       ├─ Tài khoản và phân quyền
                                       ├─ Phiên luyện và chấm điểm
                                       ├─ Tiến độ và chu kỳ 14 ngày
                                       └─ Quản trị và nhật ký thao tác
```

```text
frontend/src/
  app/                  # Router, provider, cấu hình truy cập API
  features/auth/        # Đăng ký, đăng nhập, thông tin tài khoản
  features/dashboard/   # Chỉ số, biểu đồ, lịch 14 ngày
  features/training/    # Luồng phiên luyện và xem kết quả
  features/exercises/   # Module math, memory; đăng ký bài mới
  features/admin/       # Người dùng, bài tập, thống kê, nhật ký
backend/
  pom.xml, mvnw, mvnw.cmd
  src/main/java/.../auth/
  src/main/java/.../training/
  src/main/java/.../progress/
  src/main/java/.../admin/
  src/main/resources/db/migration/
  src/test/
infra/                  # Compose, Dockerfile, tài liệu vận hành
e2e/                    # Playwright
.github/workflows/      # Build và kiểm thử
docs/                   # Thiết kế, API và hướng dẫn
```

Chia theo chức năng; mỗi module tách HTTP controller, nghiệp vụ và truy cập dữ liệu khi cần. Không tạo microservice cho từng bài tập.

## 5. Tài khoản và quyền quản trị

- Đăng ký bằng email, tên hiển thị và mật khẩu; email chuẩn hóa có unique constraint; mật khẩu băm bằng BCrypt qua Spring Security.
- Đăng nhập dùng session phía server lưu trong PostgreSQL; cookie HttpOnly, Secure ở production, SameSite=Lax. Hết hạn sau 7 ngày; đăng xuất thu hồi session.
- Frontend gọi API qua cùng origin bằng proxy/rewrite. Bật CSRF cho thao tác ghi; giới hạn origin và CORS theo môi trường, không mở wildcard cùng credentials.
- Quyền `USER` xem và quản lý dữ liệu cá nhân; `ADMIN` quản trị toàn ứng dụng. Backend kiểm tra quyền trên mọi endpoint, không dựa vào việc ẩn nút ở UI.
- Admin xem thống kê toàn hệ thống, danh sách/chi tiết người dùng và phiên luyện; khóa/mở tài khoản; cấp/thu hồi quyền; bật/tắt bài tập và chỉnh cấu hình trong giới hạn hợp lệ.
- Khóa tài khoản phải thu hồi session. Không cho khóa hoặc hạ quyền admin hoạt động cuối cùng.
- Không hiển thị mật khẩu, hash hoặc session bí mật trong API/admin/log. Khôi phục mật khẩu sử dụng liên kết dùng một lần, có hạn và lưu bản băm; gửi email thuộc đợt bổ sung sau MVP.
- Khởi tạo admin qua tác vụ quản trị riêng với email tài khoản đã tồn tại được cung cấp bằng cấu hình bí mật lúc chạy; không nâng người đăng ký đầu tiên thành admin, không cho client gửi role lúc đăng ký.
- Lưu nhật ký thay đổi quyền, trạng thái và cấu hình; vô hiệu hóa thay vì xóa lịch sử luyện tập. Admin không sửa điểm gốc của phiên đã hoàn thành.

## 6. Database và tính toàn vẹn

| Bảng | Nội dung chính và ràng buộc |
| --- | --- |
| users | UUID, email duy nhất, tên, password_hash, role, status, created_at, updated_at |
| spring_session và bảng thuộc tính | Session đăng nhập lưu phía server, migration tương ứng với Spring Session JDBC |
| exercise_types | code duy nhất, name, enabled, configuration, version |
| training_sessions | user_id, exercise_type_id, trạng thái, snapshot cấu hình, started_at, submitted_at, completed_at, expires_at, score, max_score, version |
| training_questions | session_id, question_index, prompt, choices, correct_answer riêng tư, shown_at, deadline_at; unique(session_id, question_index) |
| training_answers | session_id, question_index, selected_answer nullable khi timeout, is_correct, response_time_ms, answered_at; unique(session_id, question_index) |
| daily_progress | user_id, training_date, status, completed_at; unique(user_id, training_date) |
| training_cycles | user_id, start_date, target_days=14, status; chỉ một chu kỳ ACTIVE/người dùng |
| request_idempotency | user_id, request_key, request_hash, response và expires_at; unique(user_id, request_key) |
| admin_audit_logs | actor_id, action, target_type, target_id, thay đổi đã lọc dữ liệu nhạy cảm, created_at |

Khóa ngoại đầy đủ; index sessions(user_id, completed_at), sessions(user_id, status), daily_progress(user_id, training_date), audit(created_at). Khóa ngoại ghép từ answer đến question đảm bảo đáp án thuộc câu hỏi có thật. Điểm có CHECK 0 ≤ score ≤ max_score. Không cascade xóa lịch sử khi vô hiệu hóa người dùng hoặc bài tập.

Lưu timestamp UTC; ngày luyện được suy ra bằng `Asia/Ho_Chi_Minh` từ completed_at. Snapshot bất biến giúp xem lại đúng câu và cấu hình đã dùng dù admin cập nhật bài sau đó.

## 7. Quy tắc phiên luyện và chống gửi trùng

- Trạng thái: `IN_PROGRESS → SUBMITTED → COMPLETED`; có `EXPIRED` và `ABANDONED`. SUBMITTED là đã trả lời hết và được xem kết quả; nút Lưu kết quả chuyển sang COMPLETED để tính tiến độ.
- Mỗi người dùng chỉ có tối đa một phiên IN_PROGRESS/SUBMITTED cho mỗi loại bài. Bấm bắt đầu lại trả về phiên hiện có; bỏ phiên cũ phải là thao tác rõ ràng. Phiên có hạn tối đa 24 giờ.
- Server sinh câu, giữ đáp án và chấm điểm; request không có trường điểm được tin cậy. API câu đang làm chỉ trả prompt, lựa chọn, serverNow, deadlineAt và vị trí hiện tại.
- Mental Math: 10 câu; thời hạn từng câu 16, 15, …, 7 giây. Bốn lựa chọn phân biệt và duy nhất một đáp án đúng; toán tử cộng/trừ/nhân, độ khó tăng theo vị trí.
- Câu đầu bắt đầu khi tạo phiên. Trả lời hợp lệ mở câu kế tiếp tại thời điểm server xử lý; khi timeout, câu kế tiếp bắt đầu từ deadline của câu trước. Server xử lý nối các timeout đã qua mỗi lần truy cập, không cần timer chạy nền.
- UI hiển thị thời gian dựa trên deadline và chênh lệch serverNow; reload, đổi tab hoặc đổi đồng hồ máy không đặt lại thời hạn. Đáp án đến server tại hoặc sau deadline bị tính timeout. Nếu tất cả thời hạn đã qua, trả về trạng thái SUBMITTED.
- Memory: 6 từ khác nhau; giai đoạn ghi nhớ tối đa 30 giây, có thể bắt đầu kiểm tra sớm. Server chuyển giai đoạn một chiều; sau khi sang kiểm tra không endpoint nào trả lại bộ từ cho đến SUBMITTED.
- Mỗi câu Memory có một từ đúng thuộc bộ gốc và ba từ không thuộc bộ gốc; sáu từ đúng xuất hiện một lần theo thứ tự xáo trộn. Không cho sửa đáp án trước; không có thời hạn từng câu trong giới hạn 24 giờ của phiên.
- Không gửi đáp án đúng hoặc snapshot riêng tư trước SUBMITTED; kết quả sau nộp có đáp án chọn/đúng, trạng thái và thời gian phản hồi server ghi nhận.
- Khóa hàng session trong transaction khi ghi đáp án/complete. Unique constraint chặn gửi cùng câu hai lần; đáp án khác cho câu đã xử lý trả 409. Complete lặp trả cùng kết quả.
- POST tạo phiên, trả lời, complete và tạo chu kỳ yêu cầu Idempotency-Key; cùng khóa/cùng payload trả lại kết quả, cùng khóa/khác payload trả 409. Lưu khóa ít nhất đến 48 giờ sau khi phiên hết hạn; ràng buộc nghiệp vụ vẫn chặn trùng khi bản ghi khóa được dọn.
- Quyền sở hữu được kiểm tra bằng user hiện tại; endpoint của người dùng trả 404 khi truy cập session của người khác. Admin truy cập qua nhóm endpoint admin có kiểm tra quyền riêng.
- GET tiếp tục phiên trả trạng thái server hiện tại; mọi DTO đều loại đáp án riêng tư trong lúc đang luyện. Chống gửi điểm giả không đồng nghĩa ngăn được mọi hình thức hỗ trợ từ bên ngoài.

## 8. Tiến độ và chu kỳ 14 ngày

- Khi complete, transaction kiểm tra có cả Math và Memory COMPLETED cùng ngày Việt Nam rồi upsert daily_progress. Không có endpoint cho client tự đánh dấu hoàn thành ngày.
- Nhiều lần luyện giữ nguyên từng session nhưng chỉ tính một ngày hoàn thành. Điểm theo ngày lấy lần hoàn thành mới nhất của từng bài; điểm trung bình toàn lịch sử tính trên mọi phiên COMPLETED có điểm.
- Tổng ngày đã luyện = số ngày có ít nhất một bài COMPLETED; tổng ngày hoàn thành = số ngày đủ hai bài bắt buộc. Dashboard đặt nhãn riêng để không gây nhầm.
- Streak tính theo ngày hoàn thành: nếu hôm nay chưa đủ bài, streak vẫn giữ chuỗi kết thúc hôm qua; mất khi hôm qua cũng chưa hoàn thành. Streak dài nhất tính trên toàn bộ ngày hoàn thành, kể cả các chu kỳ cũ.
- Chu kỳ gồm start_date và 13 ngày tiếp theo. Ngày tương lai là chưa luyện; ngày đã có một bài là đang luyện; ngày quá khứ thiếu bài là bỏ lỡ; đủ hai bài là hoàn thành. Không gán ngày tương lai là bỏ lỡ.
- Tạo chu kỳ mới đóng chu kỳ hiện tại và bắt đầu ngày hôm nay; không xóa progress/session. Progress theo ngày là dữ liệu gốc, trạng thái ngày trong chu kỳ được suy ra, không cần training_cycle_days trong MVP.
- Nếu người dùng làm hai bài ở hai bên mốc nửa đêm, mỗi bài tính theo ngày hoàn thành riêng; phải đủ hai bài trong cùng một ngày để hoàn thành ngày.

## 9. API contract và màn hình

Tiền tố `/api`; timestamp ISO-8601 UTC. Kết quả thành công dạng `{data, meta}`; lỗi dạng `{error: {code, message, fieldErrors}, requestId}`. Phân trang history/admin, giới hạn kích thước request và không trả stack trace.

| Nhóm | Endpoint và hành vi |
| --- | --- |
| Auth | POST /auth/register, /auth/login, /auth/logout; GET /auth/csrf; GET /users/me |
| Bài tập | GET /exercises trả danh sách đang bật và mô tả cấu hình công khai |
| Phiên | POST /training/sessions với exerciseCode; GET /training/sessions/{id} để tiếp tục |
| Memory | POST /training/sessions/{id}/recall để kết thúc ghi nhớ sớm, thao tác lặp không đặt lại giai đoạn |
| Trả lời | POST /training/sessions/{id}/answers với questionIndex, selectedChoiceId; server quyết định hợp lệ và điểm |
| Kết thúc | POST /training/sessions/{id}/complete; POST /training/sessions/{id}/abandon; GET /training/sessions/{id}/results |
| Tiến độ | GET /progress/dashboard, /progress/daily?from=&to=, /progress/history, /progress/cycles; POST /progress/cycles |
| Admin người dùng | GET /admin/users, /admin/users/{id}, /admin/users/{id}/sessions; PATCH /admin/users/{id}/status, /admin/users/{id}/role |
| Admin hệ thống | GET /admin/overview, /admin/exercises, /admin/audit-logs; PATCH /admin/exercises/{code} |
| Health | GET /health trả trạng thái tối thiểu; readiness kiểm tra database và không công khai thông tin kết nối |

UI gồm đăng ký/đăng nhập; Dashboard với CTA luyện tiếp, chỉ số, biểu đồ, lịch 14 ngày; Math; Memory ghi nhớ/kiểm tra/kết quả; lịch sử và chi tiết; admin tổng quan/người dùng/bài tập/nhật ký.

Giao diện tiếng Việt, Ant Design tối giản, responsive; nút đáp án lớn, hỗ trợ bàn phím, thanh thời gian không nhấp nháy. Kết quả dùng icon và chữ cùng màu sắc để phân biệt đúng/sai. Có loading, lỗi mạng, dữ liệu trống và retry giữ nguyên Idempotency-Key. Chế độ tối là phần bổ sung nếu không làm chậm MVP.

## 10. Thứ tự triển khai và kiểm chứng

1. Tạo bộ khung frontend/backend, Maven Wrapper, cấu hình UTF-8, PostgreSQL local, migration, health check và tài liệu chạy. Kiểm tra build tối thiểu và migration từ database trống.
2. Làm authentication, session JDBC và phân quyền. Test đăng ký email trùng, mật khẩu sai, CSRF, đăng xuất, khóa tài khoản và user không truy cập được admin.
3. Làm engine Math/Memory và API phiên. Unit test số lựa chọn, đáp án duy nhất, độ khó, điểm, timeout tại biên, đổi giai đoạn, khôi phục và hết hạn. Dùng Clock có thể tiêm để test thời gian xác định.
4. Làm tiến độ và chu kỳ. Test một bài chưa đủ ngày; hai bài đủ ngày; nhiều lượt không nhân ngày; nửa đêm Việt Nam; streak hôm qua/hôm nay; đổi chu kỳ giữ lịch sử.
5. Làm UI và tích hợp. Component test timer, khóa chọn nhiều lần, chuyển câu, xem lại, lỗi khi lưu và retry.
6. Làm admin. Test thay đổi quyền, thu hồi session, bảo vệ admin cuối cùng, cấu hình bài và nhật ký; cấu hình mới không sửa snapshot cũ.
7. Integration test với PostgreSQL thật qua Testcontainers: rollback, unique/FK, hai request cùng câu, idempotency, hai người dùng, hai phiên cùng cập nhật tiến độ. Không dùng H2 để suy luận đặc tính PostgreSQL.
8. Playwright với backend/database thật: tạo hai tài khoản; hoàn thành 10 câu Math và 6 câu Memory; xem lại; lưu; refresh; đăng xuất/đăng nhập lại; tiếp tục phiên; daily completion; admin; truy cập chéo; sửa payload điểm không thay đổi kết quả server.
9. Chạy frontend lint, unit test và build; backend verify; Playwright. Ghi dòng tổng kết thật của từng nhóm. Tên lệnh cụ thể được chốt khi scaffold tạo scripts; hiện chưa có script để chạy.
10. Hoàn thiện README, hướng dẫn biến môi trường chỉ có tên/giá trị giả, backup/restore và cấu hình build GitHub/Vercel. Rà soát dữ liệu nhạy cảm trước bước đưa mã lên GitHub.

## 11. Đưa lên GitHub và triển khai

- Repository dự kiến tên `brain-training`, private mặc định; chưa tạo vì đang ở bước duyệt kế hoạch. Mã nguồn ở GitHub; dữ liệu người dùng ở database riêng.
- CI chạy lint/test/build. Frontend có preview; backend/database staging tách production. Không dùng database production cho E2E hoặc preview.
- Vercel đặt root frontend, build theo npm scripts, thư mục output dist, rewrite SPA và /api tới backend. Backend URL và origin được cấu hình theo môi trường.
- Backend container dùng biến môi trường DATABASE_URL, DB_USERNAME, DB_PASSWORD, APP_ALLOWED_ORIGINS và cấu hình session. Không đặt bí mật trong biến VITE_* vì chúng được đóng gói cho trình duyệt.
- Flyway chạy có kiểm soát khi khởi động; lỗi migration phải làm deployment thất bại. Backup trước migration phá vỡ tương thích; ưu tiên migration bổ sung và chiến lược sửa tiến thay vì hứa rollback dữ liệu tự động.
- Database production cần volume/lưu trữ bền vững, TLS, backup định kỳ và kiểm thử khôi phục; thay bản deploy không xóa data. Lưu lâu dài vẫn phụ thuộc tài khoản dịch vụ, chính sách lưu trữ và backup được duy trì.
- Theo tài liệu đính kèm, chỉ deploy production hoặc thay DNS sau xác nhận riêng. Xác nhận kế hoạch không tự cho phép phát hành production.

## 12. Rủi ro, quyết định cần duyệt và trạng thái bàn giao

- Cần chọn A hoặc B trước khi viết mã. A bám yêu cầu công nghệ; B phù hợp nếu ưu tiên triển khai backend/database trên Cloudflare.
- Với A, nhà cung cấp container host/PostgreSQL và ngân sách chưa được chọn; không tạo tài nguyên trả phí trong bước phân tích.
- Cloudflare cần kết nối lại trước khi quản lý tài nguyên. GitHub chưa thấy repository đích qua kết nối hiện có.
- Quyền admin rộng nhưng không bao gồm xem mật khẩu hay ghi đè lịch sử điểm; các thao tác quản trị phải được ghi nhận.
- Đợt sau: Logical Thinking với bản nháp và lời giải tham khảo; Focus với thời hạn đọc/tóm tắt do server quản lý; xác minh email và khôi phục mật khẩu qua email.

File đã tạo ở giai đoạn này: chính tài liệu kế hoạch. Chưa có mã ứng dụng nên chưa chạy build, lint, unit, integration hoặc E2E. Chưa có website, repository từ xa, database hay tài khoản admin được tạo.

## 13. Nguồn kỹ thuật đã đối chiếu

- [Vite trên Vercel và tích hợp Git](https://vercel.com/docs/frameworks/frontend/vite)
- [Các runtime của Vercel Functions, bao gồm Container](https://vercel.com/docs/functions/runtimes)
- [Yêu cầu hệ thống Spring Boot 3.5 và Java 17](https://docs.spring.io/spring-boot/3.5/system-requirements.html)
- [Cloudflare Workers: ngôn ngữ](https://developers.cloudflare.com/workers/languages/)
- [Cloudflare D1: database serverless theo ngữ nghĩa SQLite](https://developers.cloudflare.com/d1/)

Thông tin tài khoản dựa trên kết quả connector tại thời điểm kiểm tra; tài liệu Cloudflare được đọc từ nguồn công khai do connector cần xác thực lại.
