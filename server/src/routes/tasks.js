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
  INSERT INTO tasks (user_id, title, description, status, due_date)
  VALUES (?, ?, ?, ?, ?)
`);
const updateStmt = db.prepare(`
  UPDATE tasks
  SET title = ?, description = ?, status = ?, due_date = ?, updated_at = datetime('now')
  WHERE id = ? AND user_id = ?
`);
const deleteStmt = db.prepare(
  'DELETE FROM tasks WHERE id = ? AND user_id = ?'
);

// READ (list)
router.get('/', listQueryValidators, validate, (req, res) => {
  const { status } = req.query;
  const rows = status
    ? listByStatusStmt.all(req.user.id, status)
    : listStmt.all(req.user.id);
  res.json({ tasks: rows });
});

// READ (one)
router.get('/:id', idParamValidator, validate, (req, res) => {
  const task = findOneStmt.get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
  res.json({ task });
});

// CREATE
router.post('/', createTaskValidators, validate, (req, res) => {
  const { title, description = '', status = 'todo', due_date = null } = req.body;
  const info = insertStmt.run(req.user.id, title, description, status, due_date);
  const task = findOneStmt.get(info.lastInsertRowid, req.user.id);
  res.status(201).json({ task });
});

// UPDATE
router.put('/:id', updateTaskValidators, validate, (req, res) => {
  const existing = findOneStmt.get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' });

  const title = req.body.title ?? existing.title;
  const description = req.body.description ?? existing.description;
  const status = req.body.status ?? existing.status;
  const due_date = req.body.due_date ?? existing.due_date;

  updateStmt.run(title, description, status, due_date, req.params.id, req.user.id);
  const task = findOneStmt.get(req.params.id, req.user.id);
  res.json({ task });
});

// DELETE
router.delete('/:id', idParamValidator, validate, (req, res) => {
  const existing = findOneStmt.get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' });

  deleteStmt.run(req.params.id, req.user.id);
  res.status(204).send();
});

module.exports = router;
