const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const {
  registerValidators,
  loginValidators,
  updateProfileValidators,
  deleteAccountValidators,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', registerValidators, validate, async (req, res) => {
  const { email, password } = req.body;

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }

  const passwordHash = hashPassword(password);
  const info = await db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, passwordHash]);

  const token = signToken({ sub: info.lastInsertRowid, email });
  return res.status(201).json({
    token,
    user: { id: info.lastInsertRowid, email, name: null },
  });
});

router.post('/login', loginValidators, validate, async (req, res) => {
  const { email, password } = req.body;

  const user = await db.get('SELECT id, email, name, password_hash FROM users WHERE email = ?', [email]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const token = signToken({ sub: user.id, email: user.email });
  return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  return res.json({ user });
});

router.patch('/me', requireAuth, updateProfileValidators, validate, async (req, res) => {
  const name = req.body.name || null;

  await db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
  const user = await db.get('SELECT id, email, name, created_at FROM users WHERE id = ?', [req.user.id]);
  return res.json({ user });
});

router.delete('/me', requireAuth, deleteAccountValidators, validate, async (req, res) => {
  const { password } = req.body;

  const user = await db.get('SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  // Les tâches sont supprimées automatiquement (ON DELETE CASCADE).
  await db.run('DELETE FROM users WHERE id = ?', [req.user.id]);
  return res.status(204).send();
});

module.exports = router;
