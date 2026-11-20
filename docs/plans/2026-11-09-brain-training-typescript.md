# Brain Training — phương án triển khai TypeScript

Thiết kế được chọn: React 19, Vite, Ant Design 5, React Router, TanStack Query, Axios; Express 5 trên Node 22 cục bộ và Cloudflare Workers, D1 khi triển khai. SQLite cục bộ được lưu lâu dài. Hợp đồng kiểu dùng chung trong shared, giao diện trong frontend, API trong backend.

- Xây dựng xác thực, bài tính nhẩm và ghi nhớ, lịch sử, tiến độ và quản trị; lưu trạng thái phiên trên máy chủ.
- Kiểm tra bằng unit/integration với SQLite, kiểm tra trình duyệt với Chromium và kiểm tra runtime Worker/D1.
- Vite phục vụ giao diện tại cổng 5173, chuyển /api tới cổng 8787; sản phẩm giao diện tại dist/client.
- Cloudflare cấu hình bằng cf CLI và cloudflare.config.ts. D1 áp dụng backend/schema.sql trước khi dùng. Vercel phục vụ giao diện và chuyển /api tới Worker qua URL thực tế của dự án.
