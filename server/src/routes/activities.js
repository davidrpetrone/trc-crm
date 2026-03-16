const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { entity_type, entity_id } = req.query;
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });
  try {
    const { rows } = await pool.query(`
      SELECT a.*, u.name AS user_name
      FROM activities a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.entity_type=$1 AND a.entity_id=$2
      ORDER BY a.activity_date DESC, a.created_at DESC
    `, [entity_type, entity_id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  const { entity_type, entity_id, type, subject, body, activity_date } = req.body;
  if (!entity_type || !entity_id || !type) return res.status(400).json({ error: 'entity_type, entity_id, type required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO activities (user_id,entity_type,entity_id,type,subject,body,activity_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `, [req.user?.id, entity_type, entity_id, type, subject, body, activity_date || new Date().toISOString().slice(0, 10)]);

    if (entity_type === 'relationship') {
      await pool.query(`UPDATE relationships SET last_touch=CURRENT_DATE::text, updated_at=NOW() WHERE id=$1`, [entity_id]);
    }

    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM activities WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
