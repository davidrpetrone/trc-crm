const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const accounts = getDb().prepare('SELECT * FROM accounts ORDER BY name').all();
  res.json(accounts);
});

router.get('/:id', requireAuth, (req, res) => {
  const account = getDb().prepare('SELECT * FROM accounts WHERE id=?').get(req.params.id);
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json(account);
});

router.post('/', requireAuth, (req, res) => {
  const { name, industry, tier, website, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = getDb().prepare(
    'INSERT INTO accounts (name, industry, tier, website, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(name, industry, tier, website, notes);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, industry, tier, website, notes } = req.body;
  getDb().prepare(
    'UPDATE accounts SET name=?, industry=?, tier=?, website=?, notes=?, updated_at=datetime("now") WHERE id=?'
  ).run(name, industry, tier, website, notes, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM accounts WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
