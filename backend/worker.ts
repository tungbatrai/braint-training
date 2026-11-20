import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app";
import { D1Store, type D1Binding } from "./d1";
const bindings = env as unknown as { DB: D1Binding; APP_ORIGIN: string };
if (!bindings.APP_ORIGIN) throw new Error("APP_ORIGIN là bắt buộc.");
const app = createApp(new D1Store(bindings.DB), {
  appOrigin: bindings.APP_ORIGIN,
  secure: true,
});
app.listen(3000);
export default httpServerHandler({ port: 3000 });
