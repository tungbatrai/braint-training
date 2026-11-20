# Brain Training

Ứng dụng luyện tính nhẩm và ghi nhớ, theo dõi tiến độ, lịch sử và quản trị tài khoản. Giao diện React/TypeScript; API Express/TypeScript chạy trên Node.js hoặc Cloudflare Workers với D1.

## Chạy trên máy

Cài Node.js 22.18 trở lên. Riêng Cloudflare CLI phiên bản ghim yêu cầu Node.js 22.23 trở lên trong dòng 22 (hoặc phiên bản khác theo yêu cầu của gói `cf`).

```sh
npm ci
npm run dev
```

Mở http://127.0.0.1:5173, đăng ký tài khoản rồi bắt đầu luyện tập. Giao diện chuyển `/api` tới máy chủ cục bộ trên cổng 8787. SQLite tự tạo tại `.data/brain-training.sqlite`; dữ liệu vẫn còn sau khi tắt máy chủ. Có thể đặt biến `DB_PATH` để chọn đường dẫn khác, `PORT` để đổi cổng API, `APP_ORIGIN` là danh sách origin được phép, ngăn cách bằng dấu phẩy. Mặc định origin cho phép là localhost và 127.0.0.1 tại cổng 5173.

Sau khi đăng ký, cấp quyền quản trị **cho cơ sở dữ liệu cục bộ** bằng:

```sh
npm run admin:promote -- email-da-dang-ky
```

Đặt `DB_PATH` giống khi chạy API nếu đã chọn đường dẫn khác. Tải lại ứng dụng để nhận quyền mới. Không đưa mật khẩu hoặc thông tin xác thực vào mã nguồn.

Sao lưu SQLite khi ứng dụng đã dừng bằng cách sao chép cơ sở dữ liệu và các tệp journal/WAL liên quan cùng nhau. Thử khôi phục trên bản sao trước khi phụ thuộc vào bản sao lưu.

## Kiểm tra

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:worker
npm run test:cloudflare
npx playwright install chromium
npm run test:e2e
```

Kiểm thử Worker dùng Miniflare và D1 mô phỏng với schema thật. Playwright khởi động API và giao diện riêng ở cổng 8788/5174, dùng `.data/e2e.sqlite`; không xóa cơ sở dữ liệu cục bộ đang dùng. Ảnh kiểm tra được lưu tại `artifacts/screenshots/`.

## Triển khai Cloudflare và Vercel

Ứng dụng production hiện chạy tại https://braint-training.vercel.app; API chạy tại https://brain-training-api.tungsuoihai.workers.dev. `cloudflare.config.ts` mô tả Worker `brain-training-api`, binding D1 `DB` tên `brain-training`, Node compatibility, logs và traces. D1 production đã được tạo và áp dụng `backend/schema.sql`. Với tài khoản hoặc môi trường mới, cần xác thực Cloudflare, tạo D1 và áp dụng schema trước khi triển khai. Dùng `npx cf cli search "create D1 database"` và `npx cf cli search "apply SQL file to D1 database"` để tìm lệnh hiện hành; xác nhận ID thực tế và sao lưu trước khi thao tác. Tài liệu: [Cloudflare CLI](https://developers.cloudflare.com/cf/) và [cấu hình Worker](https://developers.cloudflare.com/cf/projects/cloudflare-config/).

Đặt `APP_ORIGIN` thành origin HTTPS thực tế của giao diện khi build Worker, không kèm dấu `/` cuối. Trên PowerShell đặt `$env:APP_ORIGIN="https://braint-training.vercel.app"`; trên shell Unix dùng `export APP_ORIGIN=https://braint-training.vercel.app`. Build từ chối origin trống hoặc không phải HTTPS. Chạy `npm run build:cloudflare` để tạo `.cloudflare/output/v0/`; build này được Miniflare kiểm tra bằng `npm run test:cloudflare`. Lệnh kiểm thử tạo build với origin kiểm thử, vì vậy phải chạy lại `npm run build:cloudflare` với origin thật sau kiểm thử. Dùng `npx cf deploy --prebuilt --mode worker` cho build thật đó sau khi hoàn tất tạo D1, schema và xác thực tài khoản. Nếu nhiều origin thì phân cách bằng dấu phẩy. Chạy build lại sau khi thay đổi biến, vì giá trị được gắn vào bản build. Binding này không phải thông tin bí mật. Khi cần thay đổi URL Worker, tạo lại cấu hình Vercel:

Lần triển khai đầu từng tải Worker thành công nhưng báo lỗi 404 ở bước hoàn tất, khi địa chỉ `workers.dev` chưa được bật. Nguyên nhân cụ thể chưa được xác định. Địa chỉ đã được bật và các lần triển khai lại sau đó thành công. Nếu gặp tình huống tương tự, kiểm tra trạng thái Worker và bật `workers.dev` trong Cloudflare Dashboard hoặc qua [API Worker subdomain](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/create/), rồi thử lại. Cấu hình `previewUrls: false` giữ các URL xem trước ở trạng thái tắt.

```sh
npm run configure:vercel -- https://dia-chi-worker-thuc-te
```

Lệnh tạo `vercel.json` để chuyển `/api/*` tới Worker và các đường dẫn giao diện về `index.html`. Trên Vercel chọn thư mục gốc dự án, `npm ci`, lệnh build `npm run build:frontend`, thư mục đầu ra `dist/client`. Kiểm tra lại origin, cookie và luồng đăng nhập trên môi trường thử nghiệm trước khi phát hành. Không chạy cấu hình với URL ví dụ.

Kiểm tra luồng production bằng `npx tsx scripts/verify-production.ts https://braint-training.vercel.app`. Lệnh này tạo hai tài khoản kiểm thử và dữ liệu thật trong D1; dữ liệu không tự xóa khi triển khai lại.

Để tạo quản trị viên đầu tiên trên D1, đăng ký tài khoản bình thường, sau đó cập nhật `users.role` thành `ADMIN` cho đúng email đã đăng ký bằng công cụ quản lý D1 được phân quyền, sử dụng truy vấn tham số; kiểm tra đúng cơ sở dữ liệu và tài khoản trước khi chạy. Script `admin:promote` chỉ dùng SQLite cục bộ. Các lần thay đổi tiếp theo có thể thực hiện trên giao diện quản trị.
