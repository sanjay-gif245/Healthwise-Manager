import { db } from './db';
import type { StatementSync } from 'node:sqlite';

const cache = new Map<string, StatementSync>();

/** Cached `db.prepare()` — SQLite statement prep is not free; reuse it. */
export function q(sql: string): StatementSync {
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
}
