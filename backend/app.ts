import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import type {
  ExerciseCode,
  User,
  HistoryItem,
  Day,
  SessionView,
  SessionStatus,
  Role,
  UserStatus,
} from "../shared/contracts";
import type { Store } from "./store";
import {
  createMath,
  createMemory,
  advance,
  answer,
  view,
  type TrainingState,
} from "./training";

type Row = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus | SessionStatus;
  created_at: string;
  password_hash: string;
  csrf: string;
  code: ExerciseCode;
  description: string;
  enabled: number;
  exercise_code: ExerciseCode;
  state: string;
  score: number | null;
  max_score: number;
  started_at: string;
  completed_at: string | null;
  version: number;
  fingerprint: string;
  response: string;
  start_date: string;
  target_days: number;
  n: number;
  active: number;
  actor_email: string;
  action: string;
  target_id: string;
  detail: string;
};
type Options = { clock?: () => number; appOrigin?: string; secure?: boolean };
type AuthedRequest = Request & {
  user?: User;
  csrf?: string;
  tokenHash?: string;
};
class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function fail(status: number, code: string, message: string): never {
  throw new HttpError(status, code, message);
}
const id = () => crypto.randomUUID();
const iso = (n: number) => new Date(n).toISOString();
const localDate = (n: number) =>
  new Date(n + 7 * 3600000).toISOString().slice(0, 10);
const dateShift = (date: string, n: number) =>
  new Date(Date.parse(date + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const safeUser = (r: Row): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  status: r.status as UserStatus,
  createdAt: r.created_at,
});
const exercise = (r: Row) => ({
  code: r.code,
  name: r.name,
  description: r.description,
  enabled: !!r.enabled,
});
const history = (r: Row): HistoryItem => ({
  id: r.id,
  exerciseCode: r.exercise_code,
  score: r.score,
  maxScore: r.max_score,
  status: r.status as SessionStatus,
  startedAt: r.started_at,
  completedAt: r.completed_at,
});
const asyncRoute =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
const page = (req: Request) =>
  Math.max(
    1,
    Math.min(100000, Number.parseInt(String(req.query.page || "1"), 10) || 1),
  );
const key = (req: Request) => {
  const k = req.header("Idempotency-Key");
  if (!k || k.length > 200)
    fail(400, "IDEMPOTENCY_REQUIRED", "Cần Idempotency-Key hợp lệ.");
  return k!;
};
const str = (v: unknown, min: number, max: number, label: string) => {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max)
    fail(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
  return (v as string).trim();
};
const bodyObject = (req: Request) => {
  if (
    !req.is("application/json") ||
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  )
    fail(400, "INVALID_JSON", "Yêu cầu JSON hợp lệ.");
  return req.body;
};
export function createApp(store: Store, options: Options = {}) {
  const app = express(),
    now = options.clock || Date.now,
    origins = (
      options.appOrigin || "http://localhost:5173,http://127.0.0.1:5173"
    )
      .split(",")
      .map((x) => x.trim()),
    secure = options.secure ?? false;
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }), cookieParser());
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const origin = req.header("Origin");
    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-CSRF-Token, Idempotency-Key",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, OPTIONS",
      );
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(origin && origins.includes(origin) ? 204 : 403);
      return;
    }
    if (
      !["GET", "HEAD"].includes(req.method) &&
      (!origin || !origins.includes(origin))
    ) {
      next(new HttpError(403, "ORIGIN_DENIED", "Origin không được phép."));
      return;
    }
    next();
  });
  app.use((req: AuthedRequest, _res, next) => {
    (async () => {
      const token = req.cookies?.bt_session;
      if (token) {
        const tokenHash = await hash(token);
        const row = await store.get<Row>(
          "SELECT u.*, s.csrf FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.status='ACTIVE'",
          [tokenHash, now()],
        );
        if (row) {
          req.user = safeUser(row);
          req.csrf = row.csrf;
          req.tokenHash = tokenHash;
        }
      }
      next();
    })().catch(next);
  });
  const api = express.Router();
  app.use("/api", api);
  const requireUser = (
    req: AuthedRequest,
    _res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      next(new HttpError(401, "UNAUTHORIZED", "Vui lòng đăng nhập."));
      return;
    }
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.header("X-CSRF-Token") !== req.csrf
    ) {
      next(new HttpError(403, "CSRF_INVALID", "Mã bảo vệ không hợp lệ."));
      return;
    }
    next();
  };
  const requireAdmin = (
    req: AuthedRequest,
    _res: Response,
    next: NextFunction,
  ) => {
    if (req.user?.role !== "ADMIN") {
      next(new HttpError(403, "FORBIDDEN", "Không có quyền truy cập."));
      return;
    }
    next();
  };
  api.get("/health", (_req, res) => res.json({ data: { status: "ok" } }));
  async function issue(res: Response, user: User) {
    const token = crypto.randomUUID() + crypto.randomUUID(),
      csrf = crypto.randomUUID() + crypto.randomUUID();
    await store.run("INSERT INTO auth_sessions VALUES (?,?,?,?)", [
      await hash(token),
      user.id,
      csrf,
      now() + 7 * 86400000,
    ]);
    res.cookie("bt_session", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400000,
    });
    return { user, csrfToken: csrf };
  }
  async function limit(req: Request, email: string) {
    const ip = await hash(req.ip || "unknown"),
      buckets = ["ip:" + ip, "email:" + (await hash(email))];
    for (const bucket of buckets) {
      const count = await store.get<Row>(
        "SELECT COUNT(*) AS n FROM auth_attempts WHERE bucket=? AND created_at>?",
        [bucket, now() - 15 * 60000],
      );
      if (Number(count?.n) >= (bucket.startsWith("ip:") ? 30 : 10))
        fail(429, "RATE_LIMITED", "Quá nhiều lần thử. Vui lòng thử lại sau.");
    }
    await store.batch(
      buckets.map((bucket) => ({
        sql: "INSERT INTO auth_attempts VALUES (?,?,?)",
        args: [id(), bucket, now()],
      })),
    );
  }
  api.post(
    "/auth/register",
    asyncRoute(async (req, res) => {
      const b = bodyObject(req),
        name = str(b.name, 1, 80, "Tên"),
        email = str(b.email, 3, 254, "Email").toLowerCase(),
        password = str(b.password, 8, 72, "Mật khẩu");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        new TextEncoder().encode(password).length > 72
      )
        fail(400, "VALIDATION_ERROR", "Email hoặc mật khẩu không hợp lệ.");
      await limit(req, email);
      const userId = id(),
        created = iso(now()),
        passwordHash = await bcrypt.hash(password, 12);
      try {
        await store.run(
          "INSERT INTO users(id,email,name,password_hash,role,status,created_at) VALUES (?,?,?,?,?,?,?)",
          [userId, email, name, passwordHash, "USER", "ACTIVE", created],
        );
      } catch {
        fail(409, "EMAIL_EXISTS", "Email đã được sử dụng.");
      }
      res.status(201).json({
        data: await issue(res, {
          id: userId,
          email,
          name,
          role: "USER",
          status: "ACTIVE",
          createdAt: created,
        }),
      });
    }),
  );
  api.post(
    "/auth/login",
    asyncRoute(async (req, res) => {
      const b = bodyObject(req),
        email = str(b.email, 3, 254, "Email").toLowerCase(),
        password = str(b.password, 1, 1000, "Mật khẩu");
      await limit(req, email);
      const user = await store.get<Row>("SELECT * FROM users WHERE email=?", [
        email,
      ]);
      if (
        !user ||
        new TextEncoder().encode(password).length > 72 ||
        !(await bcrypt.compare(password, user.password_hash)) ||
        user.status !== "ACTIVE"
      )
        fail(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.");
      res.json({ data: await issue(res, safeUser(user!)) });
    }),
  );
  api.post(
    "/auth/logout",
    requireUser,
    asyncRoute(async (req, res) => {
      await store.run("DELETE FROM auth_sessions WHERE token_hash=?", [
        req.tokenHash!,
      ]);
      res.clearCookie("bt_session", {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
      });
      res.json({ data: { success: true } });
    }),
  );
  api.get("/users/me", requireUser, (req: AuthedRequest, res) =>
    res.json({ data: { user: req.user, csrfToken: req.csrf } }),
  );
  api.get("/auth/csrf", requireUser, (req: AuthedRequest, res) =>
    res.json({ data: { csrfToken: req.csrf } }),
  );
  api.get(
    "/exercises",
    asyncRoute(async (_req, res) =>
      res.json({
        data: (
          await store.all<Row>("SELECT * FROM exercises ORDER BY code")
        ).map(exercise),
      }),
    ),
  );
  async function loadSession(req: AuthedRequest) {
    const row = await store.get<Row>(
      "SELECT * FROM training_sessions WHERE id=? AND user_id=?",
      [String(req.params.id), req.user!.id],
    );
    if (!row) fail(404, "NOT_FOUND", "Không tìm thấy phiên luyện.");
    return row!;
  }
  async function update(
    row: Row,
    s: TrainingState,
    completedAt: string | null = null,
  ) {
    const count = await store.run(
      "UPDATE training_sessions SET state=?,status=?,score=?,completed_at=COALESCE(completed_at,?),version=version+1 WHERE id=? AND version=?",
      [
        JSON.stringify(s),
        s.status,
        s.status === "COMPLETED" ? s.score : null,
        completedAt,
        row.id,
        row.version,
      ],
    );
    return count === 1;
  }
  async function current(row: Row) {
    for (let i = 0; i < 5; i++) {
      const s = JSON.parse(row.state) as TrainingState;
      const before = JSON.stringify(s);
      advance(s, now());
      if (JSON.stringify(s) === before || (await update(row, s)))
        return { row, state: s };
      row = (await store.get<Row>(
        "SELECT * FROM training_sessions WHERE id=?",
        [row.id],
      ))!;
    }
    return fail(409, "CONFLICT", "Phiên vừa thay đổi, vui lòng thử lại.");
  }
  async function mutate(
    req: AuthedRequest,
    action: (s: TrainingState) => void,
  ) {
    const requestKey = key(req),
      fingerprint = JSON.stringify([req.path, req.body || {}]);
    for (let i = 0; i < 5; i++) {
      const saved = await store.get<Row>(
        "SELECT * FROM request_keys WHERE user_id=? AND key=?",
        [req.user!.id, requestKey],
      );
      if (saved) {
        if (saved.fingerprint !== fingerprint)
          fail(409, "IDEMPOTENCY_CONFLICT", "Khóa đã dùng cho yêu cầu khác.");
        return JSON.parse(saved.response) as SessionView;
      }
      const row = await loadSession(req),
        s = JSON.parse(row.state) as TrainingState;
      advance(s, now());
      action(s);
      const response = view(row.id, row.exercise_code, s, now());
      try {
        await store.batch([
          {
            sql: "UPDATE training_sessions SET state=?,status=?,score=?,completed_at=COALESCE(completed_at,?),version=version+1 WHERE id=? AND version=?",
            args: [
              JSON.stringify(s),
              s.status,
              s.status === "COMPLETED" ? s.score : null,
              s.status === "COMPLETED" ? iso(now()) : null,
              row.id,
              row.version,
            ],
          },
          {
            sql: "INSERT INTO request_keys(user_id,key,fingerprint,response,created_at) SELECT ?,?,?,?,? WHERE changes()=1",
            args: [
              req.user!.id,
              requestKey,
              fingerprint,
              JSON.stringify(response),
              now(),
            ],
          },
        ]);
      } catch (e) {
        const existing = await store.get<Row>(
          "SELECT * FROM request_keys WHERE user_id=? AND key=?",
          [req.user!.id, requestKey],
        );
        if (!existing) throw e;
        if (existing.fingerprint !== fingerprint)
          fail(409, "IDEMPOTENCY_CONFLICT", "Khóa đã dùng cho yêu cầu khác.");
        return JSON.parse(existing.response) as SessionView;
      }
      const stored = await store.get<Row>(
        "SELECT * FROM request_keys WHERE user_id=? AND key=?",
        [req.user!.id, requestKey],
      );
      if (stored) return JSON.parse(stored.response) as SessionView;
    }
    return fail(409, "CONFLICT", "Phiên vừa thay đổi, vui lòng thử lại.");
  }
  api.post(
    "/training/sessions",
    requireUser,
    asyncRoute(async (req, res) => {
      const b = bodyObject(req),
        code = b.exerciseCode as ExerciseCode,
        k = key(req);
      if (code !== "math" && code !== "memory")
        fail(400, "VALIDATION_ERROR", "Bài tập không hợp lệ.");
      const fp = JSON.stringify([req.path, b]);
      for (let attempt = 0; attempt < 5; attempt++) {
        const old = await store.get<Row>(
          "SELECT * FROM request_keys WHERE user_id=? AND key=?",
          [req.user!.id, k],
        );
        if (old) {
          if (old.fingerprint !== fp)
            fail(409, "IDEMPOTENCY_CONFLICT", "Khóa đã dùng cho yêu cầu khác.");
          const saved = JSON.parse(old.response) as SessionView;
          const existing = await store.get<Row>(
            "SELECT * FROM training_sessions WHERE id=? AND user_id=?",
            [saved.id, req.user!.id],
          );
          if (!existing) fail(404, "NOT_FOUND", "Không tìm thấy phiên luyện.");
          const latest = await current(existing);
          return res.json({
            data: view(
              latest.row.id,
              latest.row.exercise_code,
              latest.state,
              now(),
            ),
          });
        }
        const ex = await store.get<Row>(
          "SELECT * FROM exercises WHERE code=?",
          [code],
        );
        if (!ex?.enabled)
          fail(400, "EXERCISE_DISABLED", "Bài tập chưa khả dụng.");
        let row = await store.get<Row>(
          "SELECT * FROM training_sessions WHERE user_id=? AND exercise_code=? AND status IN ('IN_PROGRESS','SUBMITTED')",
          [req.user!.id, code],
        );
        let activeState: TrainingState | undefined;
        if (row) {
          const latest = await current(row);
          row = latest.state.status === "EXPIRED" ? undefined : latest.row;
          if (row) activeState = latest.state;
        }
        const timestamp = now();
        const sid = row?.id ?? id();
        const state = activeState
          ? activeState
          : code === "math"
            ? createMath(timestamp)
            : createMemory(timestamp);
        const result = view(sid, code, state, timestamp);
        try {
          const statements: import("./store").Statement[] = [];
          if (!row)
            statements.push({
              sql: "INSERT INTO training_sessions(id,user_id,exercise_code,status,state,max_score,started_at) VALUES (?,?,?,?,?,?,?)",
              args: [
                sid,
                req.user!.id,
                code,
                state.status,
                JSON.stringify(state),
                state.questions.length,
                iso(timestamp),
              ],
            });
          statements.push({
            sql: "INSERT INTO request_keys VALUES (?,?,?,?,?)",
            args: [req.user!.id, k, fp, JSON.stringify(result), timestamp],
          });
          await store.batch(statements);
          return res.json({ data: result });
        } catch (error) {
          const collision = await store.get<Row>(
            "SELECT * FROM request_keys WHERE user_id=? AND key=?",
            [req.user!.id, k],
          );
          if (collision) continue;
          const competing = await store.get<Row>(
            "SELECT id FROM training_sessions WHERE user_id=? AND exercise_code=? AND status IN ('IN_PROGRESS','SUBMITTED')",
            [req.user!.id, code],
          );
          if (!competing) throw error;
        }
      }
      return fail(409, "CONFLICT", "Phiên vừa thay đổi, vui lòng thử lại.");
    }),
  );
  api.get(
    "/training/sessions/:id",
    requireUser,
    asyncRoute(async (req, res) => {
      const { row, state } = await current(await loadSession(req));
      res.json({ data: view(row.id, row.exercise_code, state, now()) });
    }),
  );
  api.get(
    "/training/sessions/:id/results",
    requireUser,
    asyncRoute(async (req, res) => {
      const { row, state } = await current(await loadSession(req));
      if (!["SUBMITTED", "COMPLETED"].includes(state.status))
        fail(409, "NOT_SUBMITTED", "Phiên chưa có kết quả.");
      res.json({ data: view(row.id, row.exercise_code, state, now()) });
    }),
  );
  api.post(
    "/training/sessions/:id/answers",
    requireUser,
    asyncRoute(async (req, res) => {
      const b = bodyObject(req);
      const result = await mutate(req, (s) => {
        if (s.status !== "IN_PROGRESS" || s.phase !== "ANSWER")
          fail(
            409,
            "INVALID_STATE",
            "Không thể trả lời ở trạng thái hiện tại.",
          );
        if (!Number.isInteger(b.questionIndex) || b.questionIndex !== s.index)
          fail(409, "QUESTION_MISMATCH", "Câu hỏi đã thay đổi.");
        if (
          typeof b.selectedChoiceId !== "string" ||
          !s.questions[s.index].choices.some((c) => c.id === b.selectedChoiceId)
        )
          fail(400, "INVALID_CHOICE", "Đáp án không hợp lệ.");
        answer(s, b.selectedChoiceId, now());
      });
      res.json({ data: result });
    }),
  );
  api.post(
    "/training/sessions/:id/recall",
    requireUser,
    asyncRoute(async (req, res) => {
      const result = await mutate(req, (s) => {
        if (s.status !== "IN_PROGRESS" || !s.words.length)
          fail(409, "INVALID_STATE", "Không thể bắt đầu kiểm tra.");
        if (s.phase === "MEMORIZE") {
          s.phase = "ANSWER";
          s.shown = now();
          s.deadline = null;
        }
      });
      res.json({ data: result });
    }),
  );
  api.post(
    "/training/sessions/:id/complete",
    requireUser,
    asyncRoute(async (req, res) => {
      const result = await mutate(req, (s) => {
        if (s.status === "SUBMITTED") s.status = "COMPLETED";
        else if (s.status !== "COMPLETED")
          fail(409, "INVALID_STATE", "Cần trả lời hết trước khi lưu.");
      });
      res.json({ data: result });
    }),
  );
  api.post(
    "/training/sessions/:id/abandon",
    requireUser,
    asyncRoute(async (req, res) => {
      const result = await mutate(req, (s) => {
        if (!["IN_PROGRESS", "SUBMITTED", "ABANDONED"].includes(s.status))
          fail(409, "INVALID_STATE", "Không thể bỏ phiên này.");
        s.status = "ABANDONED";
        s.deadline = null;
      });
      res.json({ data: result });
    }),
  );
  async function sessionRows(userId: string) {
    return store.all<Row>(
      "SELECT * FROM training_sessions WHERE user_id=? ORDER BY started_at DESC",
      [userId],
    );
  }
  function daily(rows: Row[]) {
    const days = new Map<
      string,
      { math: number | null; memory: number | null }
    >();
    for (const r of rows
      .filter((r) => r.status === "COMPLETED" && r.completed_at)
      .sort((a, b) => a.completed_at!.localeCompare(b.completed_at!))) {
      const d = localDate(Date.parse(r.completed_at!)),
        v = days.get(d) || { math: null, memory: null };
      v[r.exercise_code as ExerciseCode] = r.score;
      days.set(d, v);
    }
    return days;
  }
  async function dashboard(userId: string) {
    const rows = await sessionRows(userId),
      d = daily(rows),
      today = localDate(now()),
      done = [...d.entries()]
        .filter(([, v]) => v.math !== null && v.memory !== null)
        .map(([x]) => x)
        .sort(),
      doneSet = new Set(done);
    let longest = 0,
      run = 0,
      prev = "";
    for (const day of done) {
      run = prev && dateShift(prev, 1) === day ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = day;
    }
    let cursor = doneSet.has(today) ? today : dateShift(today, -1),
      streak = 0;
    while (doneSet.has(cursor)) {
      streak++;
      cursor = dateShift(cursor, -1);
    }
    const cycleRow = await store.get<Row>(
      "SELECT * FROM cycles WHERE user_id=? AND active=1",
      [userId],
    );
    const cycle = cycleRow
      ? {
          id: cycleRow.id,
          startDate: cycleRow.start_date,
          targetDays: cycleRow.target_days,
        }
      : null;
    const days: Day[] = cycle
      ? Array.from({ length: cycle.targetDays }, (_, i) => {
          const date = dateShift(cycle.startDate, i),
            v = d.get(date),
            both = v?.math != null && v?.memory != null;
          return {
            date,
            status:
              date > today
                ? "FUTURE"
                : both
                  ? "COMPLETED"
                  : v
                    ? date < today
                      ? "MISSED"
                      : "IN_PROGRESS"
                    : date < today
                      ? "MISSED"
                      : "NOT_STARTED",
            mathScore: v?.math ?? null,
            memoryScore: v?.memory ?? null,
          };
        })
      : [];
    const avg = (code: ExerciseCode) => {
      const list = rows.filter(
        (r) => r.status === "COMPLETED" && r.exercise_code === code,
      );
      return list.length
        ? list.reduce((n, r) => n + (100 * (r.score ?? 0)) / r.max_score, 0) /
            list.length
        : null;
    };
    const todayEntry = d.get(today);
    const activeSessions: SessionView[] = [];
    for (const row of rows.filter((r) =>
      ["IN_PROGRESS", "SUBMITTED"].includes(r.status),
    )) {
      const c = await current(row);
      if (["IN_PROGRESS", "SUBMITTED"].includes(c.state.status))
        activeSessions.push(view(row.id, row.exercise_code, c.state, now()));
    }
    return {
      today,
      totalTrainingDays: d.size,
      totalCompletedDays: done.length,
      currentStreak: streak,
      longestStreak: longest,
      averages: { math: avg("math"), memory: avg("memory") },
      todayStatus: {
        math: todayEntry?.math != null,
        memory: todayEntry?.memory != null,
        completed: doneSet.has(today),
      },
      days,
      cycle,
      activeSessions,
      history: rows.slice(0, 10).map(history),
    };
  }
  api.get(
    "/progress/dashboard",
    requireUser,
    asyncRoute(async (req, res) =>
      res.json({ data: await dashboard(req.user!.id) }),
    ),
  );
  api.get(
    "/progress/history",
    requireUser,
    asyncRoute(async (req, res) => {
      const p = page(req),
        rows = await sessionRows(req.user!.id);
      res.json({
        data: {
          items: rows.slice((p - 1) * 20, p * 20).map(history),
          total: rows.length,
          page: p,
          pageSize: 20,
        },
      });
    }),
  );
  api.get(
    "/progress/cycles",
    requireUser,
    asyncRoute(async (req, res) => {
      const rows = await store.all<Row>(
        "SELECT * FROM cycles WHERE user_id=? ORDER BY start_date DESC",
        [req.user!.id],
      );
      res.json({
        data: rows.map((r) => ({
          id: r.id,
          startDate: r.start_date,
          targetDays: r.target_days,
        })),
      });
    }),
  );
  api.post(
    "/progress/cycles",
    requireUser,
    asyncRoute(async (req, res) => {
      const k = key(req),
        fp = JSON.stringify([req.path, req.body || {}]),
        previous = await store.get<Row>(
          "SELECT * FROM request_keys WHERE user_id=? AND key=?",
          [req.user!.id, k],
        );
      if (previous) {
        if (previous.fingerprint !== fp)
          fail(409, "IDEMPOTENCY_CONFLICT", "Khóa đã dùng cho yêu cầu khác.");
        return res.json({ data: JSON.parse(previous.response) });
      }
      const cycle = { id: id(), startDate: localDate(now()), targetDays: 14 };
      try {
        await store.batch([
          {
            sql: "UPDATE cycles SET active=0 WHERE user_id=? AND active=1",
            args: [req.user!.id],
          },
          {
            sql: "INSERT INTO cycles VALUES (?,?,?,?,1)",
            args: [cycle.id, req.user!.id, cycle.startDate, 14],
          },
          {
            sql: "INSERT INTO request_keys VALUES (?,?,?,?,?)",
            args: [req.user!.id, k, fp, JSON.stringify(cycle), now()],
          },
        ]);
      } catch {
        const saved = await store.get<Row>(
          "SELECT * FROM request_keys WHERE user_id=? AND key=?",
          [req.user!.id, k],
        );
        if (!saved) throw new Error("Không thể tạo chu kỳ.");
        if (saved.fingerprint !== fp)
          fail(409, "IDEMPOTENCY_CONFLICT", "Khóa đã dùng cho yêu cầu khác.");
        return res.json({ data: JSON.parse(saved.response) });
      }
      res.json({ data: cycle });
    }),
  );
  api.use("/admin", requireUser, requireAdmin);
  api.get(
    "/admin/training/sessions/:id",
    asyncRoute(async (req, res) => {
      const session = await store.get<Row>(
        "SELECT * FROM training_sessions WHERE id=?",
        [String(req.params.id)],
      );
      if (!session) fail(404, "NOT_FOUND", "Không tìm thấy phiên luyện.");
      const { row, state } = await current(session);
      res.json({ data: view(row.id, row.exercise_code, state, now()) });
    }),
  );
  api.get(
    "/admin/overview",
    asyncRoute(async (_req, res) => {
      const users = await store.get<Row>(
          "SELECT COUNT(*) n, SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) active FROM users",
        ),
        sessions = await store.all<Row>(
          "SELECT * FROM training_sessions WHERE status='COMPLETED'",
        );
      const byUser = new Map<string, Row[]>();
      for (const s of sessions) {
        const list = byUser.get(s.user_id) || [];
        list.push(s);
        byUser.set(s.user_id, list);
      }
      let completedDays = 0;
      for (const rows of byUser.values())
        completedDays += [...daily(rows).values()].filter(
          (v) => v.math !== null && v.memory !== null,
        ).length;
      res.json({
        data: {
          usersCount: Number(users?.n || 0),
          activeUsers: Number(users?.active || 0),
          completedSessions: sessions.length,
          completedDays,
        },
      });
    }),
  );
  api.get(
    "/admin/users",
    asyncRoute(async (req, res) => {
      const p = page(req),
        search = String(req.query.search || "")
          .trim()
          .slice(0, 100),
        like = `%${search}%`,
        total = await store.get<Row>(
          "SELECT COUNT(*) n FROM users WHERE email LIKE ? OR name LIKE ?",
          [like, like],
        ),
        rows = await store.all<Row>(
          "SELECT id,email,name,role,status,created_at FROM users WHERE email LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT 20 OFFSET ?",
          [like, like, (p - 1) * 20],
        );
      res.json({
        data: {
          items: rows.map(safeUser),
          total: Number(total?.n || 0),
          page: p,
          pageSize: 20,
        },
      });
    }),
  );
  api.get(
    "/admin/users/:id/sessions",
    asyncRoute(async (req, res) => {
      const p = page(req),
        rows = await sessionRows(String(req.params.id));
      res.json({
        data: {
          items: rows.slice((p - 1) * 20, p * 20).map(history),
          total: rows.length,
          page: p,
          pageSize: 20,
        },
      });
    }),
  );
  api.patch(
    "/admin/users/:id",
    asyncRoute(async (req, res) => {
      const b = bodyObject(req),
        target = String(req.params.id);
      if (Object.keys(b).length !== 1 || (!("role" in b) && !("status" in b)))
        fail(
          400,
          "VALIDATION_ERROR",
          "Chỉ được thay đổi vai trò hoặc trạng thái.",
        );
      const field = "role" in b ? "role" : "status",
        value = b[field];
      if (
        !(
          field === "role" ? ["USER", "ADMIN"] : ["ACTIVE", "DISABLED"]
        ).includes(value)
      )
        fail(400, "VALIDATION_ERROR", "Giá trị không hợp lệ.");
      const row = await store.get<Row>("SELECT * FROM users WHERE id=?", [
        target,
      ]);
      if (!row) fail(404, "NOT_FOUND", "Không tìm thấy người dùng.");
      if (row[field] === value) return res.json({ data: safeUser(row) });
      const auditId = id();
      await store.batch([
        {
          sql: `UPDATE users SET ${field}=? WHERE id=? AND ${field}=? AND NOT (role='ADMIN' AND status='ACTIVE' AND ? IN ('USER','DISABLED') AND (SELECT COUNT(*) FROM users WHERE role='ADMIN' AND status='ACTIVE')<=1)`,
          args: [value, target, row[field], value],
        },
        {
          sql: "INSERT INTO audit_logs SELECT ?,?,?,?,?,? WHERE changes()=1",
          args: [
            auditId,
            req.user!.id,
            `user.${field}`,
            target,
            JSON.stringify({ from: row[field], to: value }),
            iso(now()),
          ],
        },
        {
          sql: "DELETE FROM auth_sessions WHERE user_id=? AND ? IN ('DISABLED','USER') AND EXISTS (SELECT 1 FROM audit_logs WHERE id=?)",
          args: [target, value, auditId],
        },
      ]);
      const audit = await store.get<Row>(
        "SELECT id FROM audit_logs WHERE id=?",
        [auditId],
      );
      if (!audit)
        fail(
          409,
          "LAST_ADMIN",
          "Không thể thay đổi quản trị viên cuối cùng hoặc dữ liệu đã thay đổi.",
        );
      res.json({
        data: safeUser(
          (await store.get<Row>("SELECT * FROM users WHERE id=?", [target]))!,
        ),
      });
    }),
  );
  api.get(
    "/admin/exercises",
    asyncRoute(async (_req, res) =>
      res.json({
        data: (
          await store.all<Row>("SELECT * FROM exercises ORDER BY code")
        ).map(exercise),
      }),
    ),
  );
  api.patch(
    "/admin/exercises/:code",
    asyncRoute(async (req, res) => {
      const b = bodyObject(req),
        code = String(req.params.code),
        row = await store.get<Row>("SELECT * FROM exercises WHERE code=?", [
          code,
        ]);
      if (!row) fail(404, "NOT_FOUND", "Không tìm thấy bài tập.");
      if (
        Object.keys(b).some(
          (k) => !["name", "description", "enabled"].includes(k),
        ) ||
        !Object.keys(b).length
      )
        fail(400, "VALIDATION_ERROR", "Cấu hình không hợp lệ.");
      const name = b.name === undefined ? row.name : str(b.name, 1, 100, "Tên"),
        description =
          b.description === undefined
            ? row.description
            : str(b.description, 1, 500, "Mô tả");
      if (b.enabled !== undefined && typeof b.enabled !== "boolean")
        fail(400, "VALIDATION_ERROR", "Trạng thái không hợp lệ.");
      const enabled = b.enabled === undefined ? !!row.enabled : b.enabled;
      await store.batch([
        {
          sql: "UPDATE exercises SET name=?,description=?,enabled=? WHERE code=?",
          args: [name, description, enabled ? 1 : 0, code],
        },
        {
          sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?,?)",
          args: [
            id(),
            req.user!.id,
            "exercise.update",
            code,
            JSON.stringify({ name, description, enabled }),
            iso(now()),
          ],
        },
      ]);
      res.json({ data: { code, name, description, enabled } });
    }),
  );
  api.get(
    "/admin/audit-logs",
    asyncRoute(async (req, res) => {
      const p = page(req),
        total = await store.get<Row>("SELECT COUNT(*) n FROM audit_logs"),
        rows = await store.all<Row>(
          "SELECT a.*,u.email actor_email FROM audit_logs a JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 20 OFFSET ?",
          [20 * (p - 1)],
        );
      res.json({
        data: {
          items: rows.map((r) => ({
            id: r.id,
            actorEmail: r.actor_email,
            action: r.action,
            targetId: r.target_id,
            createdAt: r.created_at,
            detail: r.detail,
          })),
          total: Number(total?.n || 0),
          page: p,
          pageSize: 20,
        },
      });
    }),
  );
  app.use((req, _res, next) =>
    next(new HttpError(404, "NOT_FOUND", "Không tìm thấy đường dẫn.")),
  );
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    const parseError =
      typeof err === "object" &&
      err !== null &&
      "type" in err &&
      err.type === "entity.parse.failed";
    const status =
      err instanceof HttpError ? err.status : parseError ? 400 : 500;
    res.status(status).json({
      error: {
        code:
          err instanceof HttpError
            ? err.code
            : status === 400
              ? "INVALID_JSON"
              : "INTERNAL_ERROR",
        message:
          err instanceof HttpError
            ? err.message
            : status === 400
              ? "JSON không hợp lệ."
              : "Đã xảy ra lỗi.",
      },
      requestId: id(),
    });
  });
  return app;
}
