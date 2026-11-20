import { createApp } from "./app";
import { SqliteStore } from "./sqlite";
const store = new SqliteStore(
  process.env.DB_PATH || ".data/brain-training.sqlite",
);
const app = createApp(store, {
  appOrigin: process.env.APP_ORIGIN,
  secure: process.env.NODE_ENV === "production",
});
app.listen(Number(process.env.PORT || 8787), () =>
  console.log("Brain Training API đang chạy."),
);
