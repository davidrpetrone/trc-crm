const express = require('express');
const bcrypt  = require('bcryptjs');
const { pool } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role required' });
  try {
    const hash = password ? bcrypt.hashSync(password, 10) : null;
    const { rows } = await pool.query(
      'INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email, hash, role]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, email, role, password } = req.body;
  try {
    if (password) {
      await pool.query('UPDATE users SET name=$1,email=$2,role=$3,password_hash=$4 WHERE id=$5',
        [name, email, role, bcrypt.hashSync(password, 10), req.params.id]);
    } else {
      await pool.query('UPDATE users SET name=$1,email=$2,role=$3 WHERE id=$4',
        [name, email, role, req.params.id]);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
