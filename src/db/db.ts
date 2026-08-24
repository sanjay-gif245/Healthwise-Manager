import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Node's built-in SQLite driver (stable enough for our needs, ships with
// Node 22+, zero native-binary downloads). We keep a single process-wide
// connection: SQLite handles concurrent access from one process fine, and
// our slot-hold + partial-unique-index design (see schema.sql) is what
// actually protects against double-booking, not a connection-per-request
// pattern.

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_FILE || path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

declare global {
  // eslint-disable-next-line no-var
  var __healthcareDb: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  const database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');

  const schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  database.exec(schema);

  return database;
}

// Reuse the connection across hot-reloads in dev and across route handlers
// in prod (Next.js may reuse the same Node process for many requests).
export const db: DatabaseSync = global.__healthcareDb || createConnection();
if (process.env.NODE_ENV !== 'production') {
  global.__healthcareDb = db;
}

/** Run `fn` inside a SQLite transaction, rolling back on any thrown error. */
export function withTransaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
