const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const validate = require('../middleware/validate');
const {
  idParamValidator,
  listQueryValidators,
  createTaskValidators,
  updateTaskValidators,
} = require('../validators/taskValidators');

const router = express.Router();

router.use(requireAuth);

/**
 * Convertit une valeur en type accepté par SQLite.
 *
 * SQLite accepte uniquement :
 * - number
 * - string
 * - bigint
 * - Buffer
 * - null
 */
function toSqliteValue(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    Buffer.isBuffer(value)
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

const listStmt = db.prepare(
  'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC'
);

const listByStatusStmt = db.prepare(
  'SELECT * FROM tasks WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
);

const findOneStmt = db.prepare(
  'SELECT * FROM tasks WHERE id = ? AND user_id = ?'
);

const insertStmt = db.prepare(`
  INSERT INTO tasks (
    user_id,
    title,
    description,
    status,
    due_date
  )
  VALUES (?, ?, ?, ?, ?)
`);

const updateStmt = db.prepare(`
  UPDATE tasks
  SET
    title = ?,
    description = ?,
    status = ?,
    due_date = ?,
    updated_at = datetime('now')
  WHERE id = ? AND user_id = ?
`);

const deleteStmt = db.prepare(
  'DELETE FROM tasks WHERE id = ? AND user_id = ?'
);

// ============================================================
// READ - LIST
// ============================================================

router.get('/', listQueryValidators, validate, (req, res) => {
  const userId = toSqliteValue(req.user.id);
  const status = req.query.status;

  let rows;

  if (status) {
    rows = listByStatusStmt.all(
      userId,
      toSqliteValue(status)
    );
  } else {
    rows = listStmt.all(userId);
  }

  res.json({
    tasks: rows,
  });
});

// ============================================================
// READ - ONE
// ============================================================

router.get('/:id', idParamValidator, validate, (req, res) => {
  const id = toSqliteValue(req.params.id);
  const userId = toSqliteValue(req.user.id);

  const task = findOneStmt.get(id, userId);

  if (!task) {
    return res.status(404).json({
      error: 'Tâche introuvable.',
    });
  }

  res.json({
    task,
  });
});

// ============================================================
// CREATE
// ============================================================

router.post('/', createTaskValidators, validate, (req, res) => {
  const userId = toSqliteValue(req.user.id);

  const title = toSqliteValue(
    req.body.title,
    ''
  );

  const description = toSqliteValue(
    req.body.description,
    ''
  );

  const status = toSqliteValue(
    req.body.status,
    'todo'
  );

  const dueDate = toSqliteValue(
    req.body.due_date,
    null
  );

  const info = insertStmt.run(
    userId,
    title,
    description,
    status,
    dueDate
  );

  const task = findOneStmt.get(
    toSqliteValue(info.lastInsertRowid),
    userId
  );

  res.status(201).json({
    task,
  });
});

// ============================================================
// UPDATE
// ============================================================

router.put('/:id', updateTaskValidators, validate, (req, res) => {
  const id = toSqliteValue(req.params.id);
  const userId = toSqliteValue(req.user.id);

  const existing = findOneStmt.get(
    id,
    userId
  );

  if (!existing) {
    return res.status(404).json({
      error: 'Tâche introuvable.',
    });
  }

  const title = toSqliteValue(
    req.body.title ?? existing.title,
    ''
  );

  const description = toSqliteValue(
    req.body.description ?? existing.description,
    ''
  );

  const status = toSqliteValue(
    req.body.status ?? existing.status,
    'todo'
  );

  const dueDate = toSqliteValue(
    req.body.due_date ?? existing.due_date,
    null
  );

  updateStmt.run(
    title,
    description,
    status,
    dueDate,
    id,
    userId
  );

  const task = findOneStmt.get(
    id,
    userId
  );

  res.json({
    task,
  });
});

// ============================================================
// DELETE
// ============================================================

router.delete('/:id', idParamValidator, validate, (req, res) => {
  const id = toSqliteValue(req.params.id);
  const userId = toSqliteValue(req.user.id);

  const existing = findOneStmt.get(
    id,
    userId
  );

  if (!existing) {
    return res.status(404).json({
      error: 'Tâche introuvable.',
    });
  }

  deleteStmt.run(
    id,
    userId
  );

  res.status(204).send();
});

module.exports = router;
