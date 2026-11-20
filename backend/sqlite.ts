import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Store, SqlValue, Statement } from "./store";
export class SqliteStore implements Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);",
    );
    const migration = this.db
      .prepare("SELECT version FROM schema_migrations WHERE version=1")
      .get();
    if (!migration) {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.exec(
          readFileSync(new URL("./schema.sql", import.meta.url), "utf8"),
        );
        this.db
          .prepare("INSERT INTO schema_migrations VALUES (1,?)")
          .run(new Date().toISOString());
        this.db.exec("COMMIT");
      } catch (e) {
        this.db.exec("ROLLBACK");
        throw e;
      }
    }
  }
  async get<T>(sql: string, args: SqlValue[] = []) {
    return this.db.prepare(sql).get(...args) as T | undefined;
  }
  async all<T>(sql: string, args: SqlValue[] = []) {
    return this.db.prepare(sql).all(...args) as T[];
  }
  async run(sql: string, args: SqlValue[] = []) {
    return Number(this.db.prepare(sql).run(...args).changes);
  }
  async batch(statements: Statement[]) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const s of statements) this.db.prepare(s.sql).run(...(s.args || []));
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
}
