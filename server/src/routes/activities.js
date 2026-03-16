const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const { entity_type, entity_id } = req.query;
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });

  const rows = getDb().prepare(`
    SELECT a.*, u.name as user_name
    FROM activities a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.entity_type=? AND a.entity_id=?
    ORDER BY a.activity_date DESC, a.created_at DESC
  `).all(entity_type, entity_id);

  res.json(rows);
});

router.post('/', requireAuth, (req, res) => {
  const { entity_type, entity_id, type, subject, body, activity_date } = req.body;
  if (!entity_type || !entity_id || !type) return res.status(400).json({ error: 'entity_type, entity_id, type required' });

  const result = getDb().prepare(`
    INSERT INTO activities (user_id, entity_type, entity_id, type, subject, body, activity_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user?.id, entity_type, entity_id, type, subject, body, activity_date || new Date().toISOString().slice(0, 10));

  // Update last_touch on relationship if applicable
  if (entity_type === 'relationship') {
    getDb().prepare(`UPDATE relationships SET last_touch=date('now'), updated_at=datetime('now') WHERE id=?`)
      .run(entity_id);
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM activities WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
