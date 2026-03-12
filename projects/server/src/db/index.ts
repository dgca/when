import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_URL || join(__dirname, "../../data/when.db");

// Ensure the data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Auto-create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    admin_token TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    timezone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS options (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    label TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    participant_name TEXT NOT NULL,
    edit_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS response_selections (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES responses(id),
    option_id TEXT NOT NULL REFERENCES options(id),
    value TEXT NOT NULL
  );
`);
