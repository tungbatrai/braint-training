export type SqlValue = string | number | null;
export type Statement = { sql: string; args?: SqlValue[] };
export interface Store {
  get<T>(sql: string, args?: SqlValue[]): Promise<T | undefined>;
  all<T>(sql: string, args?: SqlValue[]): Promise<T[]>;
  run(sql: string, args?: SqlValue[]): Promise<number>;
  batch(statements: Statement[]): Promise<void>;
}
