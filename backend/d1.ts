import type { Store, SqlValue, Statement } from "./store";
type D1Statement = {
  bind(...args: SqlValue[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
};
type D1Session = {
  prepare(sql: string): D1Statement;
  batch(stmts: D1Statement[]): Promise<unknown>;
};
export type D1Binding = { withSession(constraint: "first-primary"): D1Session };
export class D1Store implements Store {
  constructor(private db: D1Binding) {}
  async get<T>(sql: string, args: SqlValue[] = []) {
    return (
      (await this.db
        .withSession("first-primary")
        .prepare(sql)
        .bind(...args)
        .first<T>()) ?? undefined
    );
  }
  async all<T>(sql: string, args: SqlValue[] = []) {
    return (
      await this.db
        .withSession("first-primary")
        .prepare(sql)
        .bind(...args)
        .all<T>()
    ).results;
  }
  async run(sql: string, args: SqlValue[] = []) {
    return (
      await this.db
        .withSession("first-primary")
        .prepare(sql)
        .bind(...args)
        .run()
    ).meta.changes;
  }
  async batch(statements: Statement[]) {
    const session = this.db.withSession("first-primary");
    await session.batch(
      statements.map((s) => session.prepare(s.sql).bind(...(s.args || []))),
    );
  }
}
