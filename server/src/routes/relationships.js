const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const BASE_QUERY = `
  SELECT r.*,
    TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(NULLIF(c.mi,''),'') || ' ' || COALESCE(c.last_name,'')) as contact_name,
    c.title as contact_title, c.email as contact_email,
    a.name as account_name, a.tier as account_tier,
    u.name as owner_name
  FROM relationships r
  LEFT JOIN contacts c ON c.id = r.contact_id
  LEFT JOIN accounts a ON a.id = r.account_id
  LEFT JOIN users u ON u.id = r.owner_id
`;

router.get('/', requireAuth, (req, res) => {
  const { owner_id, stage, tier } = req.query;
  let query = BASE_QUERY;
  const params = [];
  const conditions = [];

  if (owner_id) { conditions.push('r.owner_id = ?'); params.push(owner_id); }
  if (stage) { conditions.push('r.stage = ?'); params.push(stage); }
  if (tier) { conditions.push('r.tier = ?'); params.push(tier); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY r.next_action_date ASC';

  res.json(getDb().prepare(query).all(...params));
});

router.get('/stale', requireAuth, (req, res) => {
  // Relationships with no touch in 30+ days or overdue next action
  const rows = getDb().prepare(`
    ${BASE_QUERY}
    WHERE (r.last_touch IS NULL OR r.last_touch < date('now', '-30 days'))
       OR (r.next_action_date IS NOT NULL AND r.next_action_date < date('now'))
    ORDER BY r.next_action_date ASC
  `).all();
  res.json(rows);
});

router.get('/:id', requireAuth, (req, res) => {
  const row = getDb().prepare(`${BASE_QUERY} WHERE r.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', requireAuth, (req, res) => {
  const {
    contact_id, account_id, owner_id, stage, tier,
    last_touch, next_action_date, next_action_notes,
    ea_linked, sales_motion, notes
  } = req.body;

  const result = getDb().prepare(`
    INSERT INTO relationships
      (contact_id, account_id, owner_id, stage, tier, last_touch, next_action_date,
       next_action_notes, ea_linked, sales_motion, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(contact_id, account_id, owner_id, stage || 'Target Identified', tier,
         last_touch, next_action_date, next_action_notes, ea_linked, sales_motion, notes);

  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireAuth, (req, res) => {
  const {
    contact_id, account_id, owner_id, stage, tier,
    last_touch, next_action_date, next_action_notes,
    ea_linked, sales_motion, notes
  } = req.body;

  getDb().prepare(`
    UPDATE relationships SET
      contact_id=?, account_id=?, owner_id=?, stage=?, tier=?,
      last_touch=?, next_action_date=?, next_action_notes=?,
      ea_linked=?, sales_motion=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(contact_id, account_id, owner_id, stage, tier,
         last_touch, next_action_date, next_action_notes,
         ea_linked, sales_motion, notes, req.params.id);

  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM relationships WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
