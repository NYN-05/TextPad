import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DB_PATH = join(DATA_DIR, "textpad.db");

let instance = null;

function columnExists(db, table, column) {
  return db.pragma(`table_info(${table})`).some((c) => c.name === column);
}

export function getDatabase(path = DB_PATH) {
  if (instance) return instance;
  if (path !== ":memory:" && !existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      group_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_sync_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      encrypted_patch TEXT,
      iv TEXT,
      snapshot INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER,
      FOREIGN KEY (file_id) REFERENCES files(id)
    );

    CREATE TABLE IF NOT EXISTS device_files (
      device_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      PRIMARY KEY (device_id, file_id),
      FOREIGN KEY (device_id) REFERENCES devices(id),
      FOREIGN KEY (file_id) REFERENCES files(id)
    );
  `);

  if (!columnExists(db, "devices", "group_id")) {
    db.exec("ALTER TABLE devices ADD COLUMN group_id TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(db, "files", "group_id")) {
    db.exec("ALTER TABLE files ADD COLUMN group_id TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(db, "files", "version")) {
    db.exec("ALTER TABLE files ADD COLUMN version INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists(db, "files", "deleted")) {
    db.exec("ALTER TABLE files ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnExists(db, "file_versions", "snapshot")) {
    db.exec("ALTER TABLE file_versions ADD COLUMN snapshot INTEGER NOT NULL DEFAULT 0");
  }

  instance = db;
  return db;
}
