import { describe, expect, it } from "vitest";
import request from "supertest";
import { SqliteStore } from "./sqlite";
import { createApp } from "./app";
const origin = "http://localhost:5173";
describe("API training", () => {
  it("keeps memory words private on create replay after recall and preserves completed date", async () => {
    let now = Date.parse("2026-11-09T12:00:00Z");
    const store = new SqliteStore(":memory:"),
      app = createApp(store, { clock: () => now, appOrigin: origin }),
      agent = request.agent(app);
    const reg = await agent
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ name: "An", email: "an@example.com", password: "password123" });
    expect(reg.status).toBe(201);
    const csrf = reg.body.data.csrfToken;
    const post = (url: string, k: string) =>
      agent
        .post(url)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .set("Idempotency-Key", k);
    const created = await post("/api/training/sessions", "create-memory").send({
      exerciseCode: "memory",
    });
    expect(created.body.data.words).toHaveLength(6);
    const sid = created.body.data.id;
    expect(
      (await post(`/api/training/sessions/${sid}/recall`, "recall").send({}))
        .body.data.words,
    ).toBeUndefined();
    const replay = await post("/api/training/sessions", "create-memory").send({
      exerciseCode: "memory",
    });
    expect(replay.body.data.words).toBeUndefined();
    let state = replay.body.data;
    for (let i = 0; i < 6; i++) {
      const response = await post(
        `/api/training/sessions/${sid}/answers`,
        `a${i}`,
      ).send({
        questionIndex: i,
        selectedChoiceId: state.question.choices[0].id,
      });
      expect(response.status).toBe(200);
      state = response.body.data;
    }
    expect(
      (
        await post(`/api/training/sessions/${sid}/complete`, "complete").send(
          {},
        )
      ).status,
    ).toBe(200);
    const before = await store.get<{ completed_at: string }>(
      "SELECT completed_at FROM training_sessions WHERE id=?",
      [sid],
    );
    now += 86400000;
    expect(
      (
        await post(
          `/api/training/sessions/${sid}/complete`,
          "complete-again",
        ).send({})
      ).status,
    ).toBe(200);
    const after = await store.get<{ completed_at: string }>(
      "SELECT completed_at FROM training_sessions WHERE id=?",
      [sid],
    );
    expect(after?.completed_at).toBe(before?.completed_at);
  });
});

describe("Security and progress", () => {
  it("protects ownership, scoring and completion across both exercises", async () => {
    let now = Date.parse("2026-11-09T16:59:00Z");
    const store = new SqliteStore(":memory:"),
      app = createApp(store, { clock: () => now, appOrigin: origin });
    const first = request.agent(app),
      second = request.agent(app);
    const register = async (
      agent: ReturnType<typeof request.agent>,
      email: string,
    ) =>
      agent
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({ name: "Người dùng", email, password: "password123" });
    const a = await register(first, "first@example.com"),
      b = await register(second, "second@example.com");
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const csrf = a.body.data.csrfToken;
    expect(
      (
        await first
          .post("/api/training/sessions")
          .set("Origin", origin)
          .send({ exerciseCode: "math" })
      ).status,
    ).toBe(403);
    expect(
      (
        await first
          .post("/api/training/sessions")
          .set("Origin", "https://evil.example")
          .set("X-CSRF-Token", csrf)
          .send({ exerciseCode: "math" })
      ).status,
    ).toBe(403);
    expect((await second.get("/api/admin/overview")).status).toBe(403);
    const post = (url: string, k: string) =>
      first
        .post(url)
        .set("Origin", origin)
        .set("X-CSRF-Token", csrf)
        .set("Idempotency-Key", k);
    let result = await post("/api/training/sessions", "math-create").send({
      exerciseCode: "math",
    });
    const math = result.body.data.id;
    expect((await second.get(`/api/training/sessions/${math}`)).status).toBe(
      404,
    );
    let session = result.body.data;
    for (let i = 0; i < 10; i++) {
      result = await post(
        `/api/training/sessions/${math}/answers`,
        `math-${i}`,
      ).send({
        questionIndex: i,
        selectedChoiceId: session.question.choices[0].id,
        score: 999,
      });
      expect(result.status).toBe(200);
      if (i === 0) {
        expect(
          (
            await post(`/api/training/sessions/${math}/answers`, "math-0").send(
              { questionIndex: 0, selectedChoiceId: "different" },
            )
          ).status,
        ).toBe(409);
      }
      session = result.body.data;
    }
    expect(session.score).toBeLessThanOrEqual(10);
    await post(`/api/training/sessions/${math}/complete`, "math-complete").send(
      {},
    );
    let dashboard = await first.get("/api/progress/dashboard");
    expect(dashboard.body.data.totalTrainingDays).toBe(1);
    expect(dashboard.body.data.totalCompletedDays).toBe(0);
    result = await post("/api/training/sessions", "memory-create-2").send({
      exerciseCode: "memory",
    });
    const memory = result.body.data.id;
    result = await post(
      `/api/training/sessions/${memory}/recall`,
      "memory-recall-2",
    ).send({});
    session = result.body.data;
    for (let i = 0; i < 6; i++) {
      result = await post(
        `/api/training/sessions/${memory}/answers`,
        `memory-${i}`,
      ).send({
        questionIndex: i,
        selectedChoiceId: session.question.choices[0].id,
      });
      expect(result.status).toBe(200);
      session = result.body.data;
    }
    await post(
      `/api/training/sessions/${memory}/complete`,
      "memory-complete",
    ).send({});
    dashboard = await first.get("/api/progress/dashboard");
    expect(dashboard.body.data.totalCompletedDays).toBe(1);
    expect(dashboard.body.data.currentStreak).toBe(1);
    now += 120000;
    dashboard = await first.get("/api/progress/dashboard");
    expect(dashboard.body.data.today).toBe("2026-11-10");
    expect(dashboard.body.data.currentStreak).toBe(1);
  });
  it("protects the last active administrator and revokes disabled accounts", async () => {
    const store = new SqliteStore(":memory:"),
      app = createApp(store, { appOrigin: origin }),
      admin = request.agent(app),
      user = request.agent(app);
    const register = async (
      agent: ReturnType<typeof request.agent>,
      email: string,
    ) =>
      agent
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({ name: "An", email, password: "password123" });
    const a = await register(admin, "admin@example.com"),
      u = await register(user, "user@example.com");
    await store.run("UPDATE users SET role='ADMIN' WHERE email=?", [
      "admin@example.com",
    ]);
    const csrf = a.body.data.csrfToken,
      adminId = a.body.data.user.id,
      userId = u.body.data.user.id;
    const patch = (path: string) =>
      admin.patch(path).set("Origin", origin).set("X-CSRF-Token", csrf);
    expect(
      (await patch(`/api/admin/users/${adminId}`).send({ status: "DISABLED" }))
        .status,
    ).toBe(409);
    expect(
      (await patch(`/api/admin/users/${userId}`).send({ status: "DISABLED" }))
        .status,
    ).toBe(200);
    expect((await user.get("/api/users/me")).status).toBe(401);
    const logs = await admin.get("/api/admin/audit-logs");
    expect(logs.body.data.items).toHaveLength(1);
  });
});
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

it("retains accounts and authentication across SQLite restarts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "brain-training-test-"));
  try {
    const path = join(dir, "data.sqlite"),
      firstStore = new SqliteStore(path),
      firstApp = createApp(firstStore, { appOrigin: origin }),
      first = request.agent(firstApp);
    const registered = await first
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        name: "An",
        email: "persistent@example.com",
        password: "password123",
      });
    const cookie = registered.headers["set-cookie"];
    const created = await first
      .post("/api/training/sessions")
      .set("Origin", origin)
      .set("X-CSRF-Token", registered.body.data.csrfToken)
      .set("Idempotency-Key", "persist-session")
      .send({ exerciseCode: "memory" });
    expect(created.status).toBe(200);
    const sessionId = created.body.data.id;
    firstStore.db.close();
    const secondStore = new SqliteStore(path),
      secondApp = createApp(secondStore, { appOrigin: origin });
    const me = await request(secondApp)
      .get("/api/users/me")
      .set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("persistent@example.com");
    const saved = await request(secondApp)
      .get("/api/progress/history")
      .set("Cookie", cookie);
    expect(saved.body.data.items[0].id).toBe(sessionId);
    secondStore.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("accepts a retried answer once and rejects a competing answer", async () => {
  const store = new SqliteStore(":memory:");
  const agent = request.agent(createApp(store, { appOrigin: origin }));
  const registered = await agent
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "An", email: "race@example.com", password: "password123" });
  const csrf = registered.body.data.csrfToken;
  const post = (url: string, k: string) =>
    agent
      .post(url)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .set("Idempotency-Key", k);
  const created = await post("/api/training/sessions", "race-create").send({
    exerciseCode: "math",
  });
  const session = created.body.data,
    url = `/api/training/sessions/${session.id}/answers`,
    payload = {
      questionIndex: 0,
      selectedChoiceId: session.question.choices[0].id,
    };
  const [one, two] = await Promise.all([
    post(url, "race-answer").send(payload),
    post(url, "race-answer").send(payload),
  ]);
  expect([one.status, two.status]).toEqual([200, 200]);
  expect(one.body.data).toEqual(two.body.data);
  const conflicting = await post(url, "race-other").send({
    questionIndex: 0,
    selectedChoiceId: session.question.choices[1].id,
  });
  expect(conflicting.status).toBe(409);
  const row = await store.get<{ state: string }>(
    "SELECT state FROM training_sessions WHERE id=?",
    [session.id],
  );
  expect(JSON.parse(row!.state).answers).toHaveLength(1);
});

it("allows only administrators to review another member session without exposing active answers", async () => {
  const store = new SqliteStore(":memory:");
  const app = createApp(store, { appOrigin: origin });
  const admin = request.agent(app),
    member = request.agent(app);
  const register = (agent: ReturnType<typeof request.agent>, email: string) =>
    agent
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ name: "An", email, password: "password123" });
  await register(admin, "review-admin@example.com");
  const registered = await register(member, "review-member@example.com");
  await store.run("UPDATE users SET role='ADMIN' WHERE email=?", [
    "review-admin@example.com",
  ]);
  const csrf = registered.body.data.csrfToken;
  const post = (url: string, k: string) =>
    member
      .post(url)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .set("Idempotency-Key", k);
  const created = await post("/api/training/sessions", "review-create").send({
    exerciseCode: "memory",
  });
  const sid = created.body.data.id;
  let result = await post(
    `/api/training/sessions/${sid}/recall`,
    "review-recall",
  ).send({});
  expect((await member.get(`/api/admin/training/sessions/${sid}`)).status).toBe(
    403,
  );
  expect((await admin.get(`/api/training/sessions/${sid}`)).status).toBe(404);
  const active = await admin.get(`/api/admin/training/sessions/${sid}`);
  expect(active.status).toBe(200);
  expect(active.body.data.words).toBeUndefined();
  expect(active.body.data.answers).toBeUndefined();
  let session = result.body.data;
  for (let i = 0; i < 6; i++) {
    result = await post(
      `/api/training/sessions/${sid}/answers`,
      `review-${i}`,
    ).send({
      questionIndex: i,
      selectedChoiceId: session.question.choices[0].id,
    });
    session = result.body.data;
  }
  await post(`/api/training/sessions/${sid}/complete`, "review-complete").send(
    {},
  );
  const review = await admin.get(`/api/admin/training/sessions/${sid}`);
  expect(review.status).toBe(200);
  expect(review.body.data.status).toBe("COMPLETED");
  expect(review.body.data.answers).toHaveLength(6);
  expect(review.body.data.answers[0].correctChoiceId).toBeDefined();
});

it("rolls back a competing create when the same key has different payloads", async () => {
  const database = new SqliteStore(":memory:");
  let gateEnabled = false,
    waiting = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const wrapped: import("./store").Store = {
    async get<T>(sql: string, args?: import("./store").SqlValue[]) {
      const found = await database.get<T>(sql, args);
      if (
        gateEnabled &&
        sql.includes("SELECT * FROM request_keys") &&
        waiting < 2
      ) {
        waiting++;
        if (waiting === 2) release();
        await gate;
      }
      return found;
    },
    all: (sql, args) => database.all(sql, args),
    run: (sql, args) => database.run(sql, args),
    batch: (statements) => database.batch(statements),
  };
  const agent = request.agent(createApp(wrapped, { appOrigin: origin }));
  const registered = await agent
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "An", email: "atomic@example.com", password: "password123" });
  const csrf = registered.body.data.csrfToken;
  gateEnabled = true;
  const create = (exerciseCode: string) =>
    agent
      .post("/api/training/sessions")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .set("Idempotency-Key", "shared-key")
      .send({ exerciseCode });
  const [a, b] = await Promise.all([create("math"), create("memory")]);
  expect([a.status, b.status].sort()).toEqual([200, 409]);
  const sessions = await database.all("SELECT id FROM training_sessions");
  expect(sessions).toHaveLength(1);
});

it("resuming an elapsed memory session does not reveal its old word list", async () => {
  let now = 1000000;
  const store = new SqliteStore(":memory:");
  const agent = request.agent(
    createApp(store, { appOrigin: origin, clock: () => now }),
  );
  const registered = await agent
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "An", email: "resume@example.com", password: "password123" });
  const csrf = registered.body.data.csrfToken;
  const create = (key: string) =>
    agent
      .post("/api/training/sessions")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .set("Idempotency-Key", key)
      .send({ exerciseCode: "memory" });
  expect((await create("one")).body.data.words).toHaveLength(6);
  now += 30000;
  const resumed = await create("two");
  expect(resumed.body.data.phase).toBe("ANSWER");
  expect(resumed.body.data.words).toBeUndefined();
});
