const path = require('node:path');
const fs = require('node:fs');

const usePostgres = Boolean(process.env.DATABASE_URL);

/**
 * Convertit une chaîne SQL avec des paramètres positionnels `?`
 * (syntaxe SQLite) en syntaxe Postgres `$1, $2, ...`.
 */
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

let ready;
let backend;

if (usePostgres) {
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
  });

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      due_date TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  `;

  ready = pool.query(schema);

  backend = {
    async all(sql, params = []) {
      const result = await pool.query(toPgPlaceholders(sql), params);
      return result.rows;
    },
    async get(sql, params = []) {
      const result = await pool.query(toPgPlaceholders(sql), params);
      return result.rows[0];
    },
    async run(sql, params = []) {
      const isInsert = /^\s*insert/i.test(sql) && !/returning/i.test(sql);
      const text = isInsert ? `${sql.replace(/;?\s*$/, '')} RETURNING id` : sql;
      const result = await pool.query(toPgPlaceholders(text), params);
      return {
        lastInsertRowid: isInsert ? result.rows[0]?.id : undefined,
        changes: result.rowCount,
      };
    },
  };
} else {
  const Database = require('better-sqlite3');

  const dbPath = process.env.DB_PATH || './data/app.db';
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const sqliteDb = new Database(resolvedPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
  `);

  const stmtCache = new Map();
  function prepared(sql) {
    let stmt = stmtCache.get(sql);
    if (!stmt) {
      stmt = sqliteDb.prepare(sql);
      stmtCache.set(sql, stmt);
    }
    return stmt;
  }

  ready = Promise.resolve();

  backend = {
    async all(sql, params = []) {
      return prepared(sql).all(...params);
    },
    async get(sql, params = []) {
      return prepared(sql).get(...params);
    },
    async run(sql, params = []) {
      const info = prepared(sql).run(...params);
      return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
    },
  };
}

module.exports = {
  ready,
  isPostgres: usePostgres,
  all: (sql, params) => backend.all(sql, params),
  get: (sql, params) => backend.get(sql, params),
  run: (sql, params) => backend.run(sql, params),
};
