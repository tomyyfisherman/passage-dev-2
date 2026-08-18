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

// READ (list)
router.get('/', listQueryValidators, validate, async (req, res) => {
  const { status } = req.query;
  const rows = status
    ? await db.all('SELECT * FROM tasks WHERE user_id = ? AND status = ? ORDER BY created_at DESC', [req.user.id, status])
    : await db.all('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ tasks: rows });
});

// READ (one)
router.get('/:id', idParamValidator, validate, async (req, res) => {
  const task = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
  res.json({ task });
});

// CREATE
router.post('/', createTaskValidators, validate, async (req, res) => {
  const { title, description = '', status = 'todo', due_date = null } = req.body;
  const info = await db.run(
    'INSERT INTO tasks (user_id, title, description, status, due_date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, title, description, status, due_date]
  );
  const task = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [info.lastInsertRowid, req.user.id]);
  res.status(201).json({ task });
});

// UPDATE
router.put('/:id', updateTaskValidators, validate, async (req, res) => {
  const existing = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' });

  const title = req.body.title ?? existing.title;
  const description = req.body.description ?? existing.description;
  const status = req.body.status ?? existing.status;
  const due_date = req.body.due_date ?? existing.due_date;

  await db.run(
    "UPDATE tasks SET title = ?, description = ?, status = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
    [title, description, status, due_date, req.params.id, req.user.id]
  );
  const task = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ task });
});

// DELETE
router.delete('/:id', idParamValidator, validate, async (req, res) => {
  const existing = await db.get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' });

  await db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.status(204).send();
});

module.exports = router;
