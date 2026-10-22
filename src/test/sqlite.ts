import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Solo para tests: SQLite real (`node:sqlite`, Node 22.5+) con las migraciones de verdad.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

/** API de better-sqlite3 (la que usa Drizzle) sobre `node:sqlite`, más la de expo-sqlite. */
export function sqliteClient() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const dir = join(__dirname, '../../drizzle');
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(join(dir, file), 'utf8').split(
      '--> statement-breakpoint',
    )) {
      sqlite.exec(statement);
    }
  }
  const values = (row: unknown) => (row ? Object.values(row as object) : undefined);
  const params = (args: unknown[]) =>
    args.map((a) => (typeof a === 'boolean' ? Number(a) : a)) as never[];
  return {
    sqlite,
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        run: (...args: unknown[]) => stmt.run(...params(args)),
        all: (...args: unknown[]) => stmt.all(...params(args)),
        get: (...args: unknown[]) => stmt.get(...params(args)),
        raw: () => ({
          all: (...args: unknown[]) => stmt.all(...params(args)).map(values),
          get: (...args: unknown[]) => values(stmt.get(...params(args))),
        }),
      };
    },
    transaction(fn: (tx: unknown) => unknown) {
      const run = (tx: unknown) => {
        sqlite.exec('BEGIN');
        try {
          const result = fn(tx);
          sqlite.exec('COMMIT');
          return result;
        } catch (e) {
          sqlite.exec('ROLLBACK');
          throw e;
        }
      };
      return { deferred: run, immediate: run, exclusive: run };
    },
    execAsync: async (sql: string) => sqlite.exec(sql),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
    withTransactionAsync: async (task: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
