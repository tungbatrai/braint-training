import { randomBytes, randomUUID } from "node:crypto";
import type { Dashboard, HistoryItem, Page, SessionView, User } from "../shared/contracts";

type Auth = { user: User; csrfToken: string };
type Envelope<T> = { data: T };
type RequestOptions = { method?: "GET" | "POST"; body?: unknown; key?: string; expected?: number };

function check(condition: unknown, stage: string): asserts condition {
  if (!condition) throw new Error(`Kiểm tra thất bại: ${stage}`);
}

class Client {
  private cookies = new Map<string, string>();
  private csrf = "";
  constructor(private readonly origin: string) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = { Origin: this.origin };
    if (this.cookies.size) headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    if (method !== "GET") {
      headers["Content-Type"] = "application/json";
      if (this.csrf) headers["X-CSRF-Token"] = this.csrf;
      if (options.key) headers["Idempotency-Key"] = options.key;
    }
    let response: Response;
    try {
      response = await fetch(`${this.origin}/api${path}`, {
        method, headers, redirect: "manual", signal: AbortSignal.timeout(15_000),
        ...(method === "POST" ? { body: JSON.stringify(options.body ?? {}) } : {}),
      });
    } catch {
      throw new Error(`Không kết nối được API: ${method} ${path.replace(/\/sessions\/[^/]+/g, "/sessions/:id")}`);
    }
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(";", 1)[0];
      const equal = first.indexOf("=");
      if (equal < 1) continue;
      const name = first.slice(0, equal);
      const value = first.slice(equal + 1);
      if (!value) this.cookies.delete(name); else this.cookies.set(name, value);
    }
    if (response.status !== (options.expected ?? 200)) {
      throw new Error(`HTTP ${response.status}: ${method} ${path.replace(/\/sessions\/[^/]+/g, "/sessions/:id")}`);
    }
    if (options.expected && options.expected >= 400) return undefined as T;
    let result: Envelope<T>;
    try { result = await response.json() as Envelope<T>; }
    catch { throw new Error(`Phản hồi JSON không hợp lệ: ${method} ${path.replace(/\/sessions\/[^/]+/g, "/sessions/:id")}`); }
    check(result && typeof result === "object" && "data" in result, "cấu trúc phản hồi API");
    return result.data;
  }

  async register(email: string, password: string): Promise<void> {
    const auth = await this.request<Auth>("/auth/register", {
      method: "POST", expected: 201, body: { name: "Kiểm thử triển khai", email, password },
    });
    check(auth.user.role === "USER" && !!auth.csrfToken, "tài khoản mới có quyền USER");
    this.csrf = auth.csrfToken;
  }
  async login(email: string, password: string): Promise<void> {
    const auth = await this.request<Auth>("/auth/login", { method: "POST", body: { email, password } });
    check(auth.user.role === "USER" && !!auth.csrfToken, "đăng nhập lại");
    this.csrf = auth.csrfToken;
  }
  async logout(): Promise<void> {
    await this.request("/auth/logout", { method: "POST" });
    this.csrf = "";
  }
}

function publicQuestion(state: SessionView, index: number): NonNullable<SessionView["question"]> {
  check(state.status === "IN_PROGRESS" && state.phase === "ANSWER" && state.questionIndex === index, "trạng thái câu hỏi");
  check(state.question && Array.isArray(state.question.choices) && state.question.choices.length > 0, "lựa chọn công khai");
  check(!("correctChoiceId" in state.question) && !("correct" in state.question) && !("answers" in state), "không lộ đáp án trong phiên");
  if (state.deadlineAt !== null) check(state.deadlineAt > state.serverNow, "hạn trả lời còn hiệu lực");
  return state.question;
}

async function answer(client: Client, state: SessionView, selectedChoiceId: string): Promise<SessionView> {
  return client.request(`/training/sessions/${state.id}/answers`, {
    method: "POST", key: randomUUID(), body: { questionIndex: state.questionIndex, selectedChoiceId },
  });
}

async function finish(client: Client, state: SessionView, expectedScore: number): Promise<void> {
  check(state.status === "SUBMITTED" && state.phase === "RESULT" && state.score === expectedScore, "kết quả trước khi lưu");
  check(Array.isArray(state.answers) && state.answers.length === expectedScore, "đầy đủ nội dung xem lại");
  const completed = await client.request<SessionView>(`/training/sessions/${state.id}/complete`, { method: "POST", key: randomUUID() });
  check(completed.status === "COMPLETED" && completed.score === expectedScore, "lưu kết quả");
}

async function main(): Promise<void> {
  const input = process.argv[2];
  let origin: string;
  try {
    const parsed = new URL(input);
    check(parsed.protocol === "https:" && parsed.origin === input && !parsed.username && !parsed.password, "URL HTTPS gốc");
    origin = parsed.origin;
  } catch { throw new Error("Cần URL HTTPS gốc, không có đường dẫn hoặc dấu / cuối."); }

  const email = `deployment-test-${randomBytes(12).toString("hex")}@example.test`;
  const otherEmail = `deployment-test-${randomBytes(12).toString("hex")}@example.test`;
  const password = `${randomBytes(24).toString("base64url")}a1!`;
  const client = new Client(origin);
  const other = new Client(origin);
  const health = await client.request<{ status: string }>("/health");
  check(health.status === "ok", "health");
  console.log("✓ API health");
  await client.register(email, password);
  await client.request("/admin/overview", { expected: 403 });
  console.log("✓ Đăng ký USER và chặn quản trị");

  await other.register(otherEmail, password);
  const createKey = randomUUID();
  let math = await client.request<SessionView>("/training/sessions", { method: "POST", key: createKey, body: { exerciseCode: "math" } });
  const replay = await client.request<SessionView>("/training/sessions", { method: "POST", key: createKey, body: { exerciseCode: "math" } });
  check(replay.id === math.id && replay.questionIndex === math.questionIndex, "tạo phiên idempotent");
  await other.request(`/training/sessions/${math.id}`, { expected: 404 });
  await other.request("/admin/overview", { expected: 403 });
  console.log("✓ Idempotency và cách ly tài khoản");

  for (let i = 0; i < 10; i++) {
    const question = publicQuestion(math, i);
    const match = /^(\d+)\s*([+−×])\s*(\d+)\s*=\s*\?$/.exec(question.prompt);
    check(match, "đề tính nhẩm");
    const a = Number(match[1]), b = Number(match[3]);
    const expected = match[2] === "+" ? a + b : match[2] === "−" ? a - b : a * b;
    const choice = question.choices.find((item) => item.text === String(expected));
    check(choice, "đáp án tính được");
    math = await answer(client, math, choice.id);
  }
  await finish(client, math, 10);
  console.log("✓ Tính nhẩm: 10/10 và lưu kết quả");

  let memory = await client.request<SessionView>("/training/sessions", { method: "POST", key: randomUUID(), body: { exerciseCode: "memory" } });
  check(memory.phase === "MEMORIZE" && memory.words?.length === 6 && memory.deadlineAt !== null && memory.deadlineAt - memory.serverNow <= 30_000 && memory.deadlineAt > memory.serverNow, "giai đoạn ghi nhớ");
  const words = new Set(memory.words);
  memory = await client.request<SessionView>(`/training/sessions/${memory.id}/recall`, { method: "POST", key: randomUUID() });
  check(!("words" in memory) && !("wordsReview" in memory), "ẩn danh sách sau ghi nhớ");
  for (let i = 0; i < 6; i++) {
    const question = publicQuestion(memory, i);
    const matches = question.choices.filter((item) => words.has(item.text));
    check(matches.length === 1, "lựa chọn ghi nhớ");
    memory = await answer(client, memory, matches[0].id);
  }
  await finish(client, memory, 6);
  console.log("✓ Ghi nhớ: 6/6 và lưu kết quả");

  const verifyProgress = async () => {
    const dashboard = await client.request<Dashboard>("/progress/dashboard");
    const history = await client.request<Page<HistoryItem>>("/progress/history");
    check(dashboard.todayStatus.completed && dashboard.todayStatus.math && dashboard.todayStatus.memory, "hoàn thành hai bài hôm nay");
    check(dashboard.totalCompletedDays === 1 && dashboard.currentStreak === 1, "tiến độ và chuỗi");
    check(history.total === 2 && history.items.filter((item) => item.status === "COMPLETED").length === 2, "lịch sử hai bài");
  };
  await verifyProgress();
  await client.logout();
  await client.request("/progress/dashboard", { expected: 401 });
  await client.login(email, password);
  await verifyProgress();
  console.log("✓ Tiến độ, lịch sử và dữ liệu sau đăng nhập lại");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Kiểm tra triển khai thất bại.");
  process.exitCode = 1;
});
