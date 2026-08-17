const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const validate = require('../middleware/validate');
const requireAuth = require('../middleware/requireAuth');
const { registerValidators, loginValidators } = require('../validators/authValidators');

const router = express.Router();

const insertUserStmt = db.prepare(
  'INSERT INTO users (email, password_hash) VALUES (?, ?)'
);
const findUserByEmailStmt = db.prepare(
  'SELECT id, email, password_hash FROM users WHERE email = ?'
);
const findUserByIdStmt = db.prepare(
  'SELECT id, email, created_at FROM users WHERE id = ?'
);

router.post('/register', registerValidators, validate, (req, res) => {
  const { email, password } = req.body;

  const existing = findUserByEmailStmt.get(email);
  if (existing) {
    return res.status(409).json({ error: 'Un compte existe deja avec cet email.' });
  }

  const passwordHash = hashPassword(password);
  const info = insertUserStmt.run(email, passwordHash);

  const token = signToken({ sub: info.lastInsertRowid, email });
  return res.status(201).json({
    token,
    user: { id: info.lastInsertRowid, email },
  });
});

router.post('/login', loginValidators, validate, (req, res) => {
  const { email, password } = req.body;

  const user = findUserByEmailStmt.get(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const token = signToken({ sub: user.id, email: user.email });
  return res.json({ token, user: { id: user.id, email: user.email } });
});

router.get('/me', requireAuth, (req, res) => {
  const user = findUserByIdStmt.get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  return res.json({ user });
});

module.exports = router;
