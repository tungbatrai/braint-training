import { SqliteStore } from "./sqlite";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Cần truyền email tài khoản đã đăng ký.");
  process.exit(1);
}
const store = new SqliteStore(
  process.env.DB_PATH || ".data/brain-training.sqlite",
);
const changed = await store.run(
  "UPDATE users SET role='ADMIN' WHERE email=? AND status='ACTIVE'",
  [email],
);
if (!changed) {
  console.error("Không tìm thấy tài khoản hoạt động.");
  process.exit(1);
}
console.log("Đã cấp quyền quản trị cho tài khoản được chỉ định.");
