import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

let url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dbPath = join(__dirname, "../../data/when.db");
  mkdirSync(dirname(dbPath), { recursive: true });
  url = `file:${dbPath}`;
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });

// Auto-create tables
await client.executeMultiple(`
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    admin_token TEXT NOT NULL,
    creator_name TEXT NOT NULL DEFAULT 'n/a',
    title TEXT NOT NULL,
    description TEXT,
    timezone TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'poll',
    date_range_start TEXT,
    date_range_end TEXT,
    chosen_option_id TEXT,
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

  CREATE TABLE IF NOT EXISTS availability_slots (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES responses(id),
    date TEXT NOT NULL,
    start_hour INTEGER NOT NULL,
    start_minute INTEGER NOT NULL,
    end_hour INTEGER NOT NULL,
    end_minute INTEGER NOT NULL
  );
`);

// Migrations
for (const sql of [
  `ALTER TABLE plans ADD COLUMN creator_name TEXT NOT NULL DEFAULT 'n/a'`,
  `ALTER TABLE plans ADD COLUMN chosen_option_id TEXT`,
]) {
  try {
    await client.execute(sql);
  } catch {
    // Column already exists
  }
}
