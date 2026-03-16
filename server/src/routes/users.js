const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const users = getDb().prepare('SELECT id, name, email, role, created_at FROM users').all();
  res.json(users);
});

router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role required' });
  const hash = password ? bcrypt.hashSync(password, 10) : null;
  const result = getDb().prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hash, role);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { name, email, role, password } = req.body;
  const db = getDb();
  if (password) {
    db.prepare('UPDATE users SET name=?, email=?, role=?, password_hash=? WHERE id=?')
      .run(name, email, role, bcrypt.hashSync(password, 10), req.params.id);
  } else {
    db.prepare('UPDATE users SET name=?, email=?, role=? WHERE id=?')
      .run(name, email, role, req.params.id);
  }
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  getDb().prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
