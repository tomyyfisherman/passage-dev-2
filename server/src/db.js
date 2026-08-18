const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Erreur : la variable d\'environnement DATABASE_URL est manquante (voir .env.example).');
  process.exit(1);
}

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

const ready = pool.query(schema);

/**
 * Convertit une chaîne SQL avec des paramètres positionnels `?`
 * en syntaxe Postgres `$1, $2, ...`.
 */
function toPgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function all(sql, params = []) {
  const result = await pool.query(toPgPlaceholders(sql), params);
  return result.rows;
}

async function get(sql, params = []) {
  const result = await pool.query(toPgPlaceholders(sql), params);
  return result.rows[0];
}

async function run(sql, params = []) {
  const isInsert = /^\s*insert/i.test(sql) && !/returning/i.test(sql);
  const text = isInsert ? `${sql.replace(/;?\s*$/, '')} RETURNING id` : sql;
  const result = await pool.query(toPgPlaceholders(text), params);
  return {
    lastInsertRowid: isInsert ? result.rows[0]?.id : undefined,
    changes: result.rowCount,
  };
}

module.exports = { ready, all, get, run };
