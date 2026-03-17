const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const BASE_QUERY = `
  SELECT r.*,
    TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(NULLIF(c.mi,''),'') || ' ' || COALESCE(c.last_name,'')) AS contact_name,
    c.title AS contact_title, c.email AS contact_email,
    a.name AS account_name, a.tier AS account_tier,
    u.name AS owner_name
  FROM relationships r
  LEFT JOIN contacts c ON c.id = r.contact_id
  LEFT JOIN accounts a ON a.id = r.account_id
  LEFT JOIN users u ON u.id = r.owner_id
`;

router.get('/', requireAuth, async (req, res) => {
  const { owner_id, stage, tier } = req.query;
  const conditions = ['COALESCE(c.is_active, true) = true'], params = [];
  if (owner_id) { params.push(owner_id); conditions.push(`r.owner_id=$${params.length}`); }
  if (stage)    { params.push(stage);    conditions.push(`r.stage=$${params.length}`); }
  if (tier)     { params.push(tier);     conditions.push(`r.tier=$${params.length}`); }
  const where = ' WHERE ' + conditions.join(' AND ');
  try {
    const { rows } = await pool.query(`${BASE_QUERY}${where} ORDER BY r.next_action_date ASC NULLS LAST`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/active-contacts', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id AS contact_id,
        TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(NULLIF(c.mi,''),'') || ' ' || COALESCE(c.last_name,'')) AS contact_name,
        c.title AS contact_title, c.email AS contact_email,
        COALESCE(ra.name, ca.name) AS account_name,
        r.id, r.stage, r.tier, r.last_touch, r.next_action_date, r.next_action_notes,
        r.ea_linked, r.sales_motion, r.notes, r.owner_id, r.account_id,
        u.name AS owner_name
      FROM contacts c
      LEFT JOIN relationships r ON r.contact_id = c.id
      LEFT JOIN accounts ca ON ca.id = c.account_id
      LEFT JOIN accounts ra ON ra.id = r.account_id
      LEFT JOIN users u ON u.id = r.owner_id
      WHERE COALESCE(c.is_active, true) = true
      ORDER BY r.next_action_date ASC NULLS LAST, c.last_name, c.first_name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stale', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      ${BASE_QUERY}
      WHERE (r.last_touch IS NULL OR r.last_touch < (CURRENT_DATE - INTERVAL '30 days')::text)
         OR (r.next_action_date IS NOT NULL AND r.next_action_date < CURRENT_DATE::text)
      ORDER BY r.next_action_date ASC NULLS LAST
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE_QUERY} WHERE r.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  const { contact_id, account_id, owner_id, stage, tier, last_touch, next_action_date, next_action_notes, ea_linked, sales_motion, notes } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO relationships
        (contact_id,account_id,owner_id,stage,tier,last_touch,next_action_date,next_action_notes,ea_linked,sales_motion,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `, [contact_id, account_id, owner_id, stage || 'Relationship Active', tier, last_touch, next_action_date, next_action_notes, ea_linked, sales_motion, notes]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { contact_id, account_id, owner_id, stage, tier, last_touch, next_action_date, next_action_notes, ea_linked, sales_motion, notes } = req.body;
  try {
    await pool.query(`
      UPDATE relationships SET
        contact_id=$1, account_id=$2, owner_id=$3, stage=$4, tier=$5,
        last_touch=$6, next_action_date=$7, next_action_notes=$8,
        ea_linked=$9, sales_motion=$10, notes=$11, updated_at=NOW()
      WHERE id=$12
    `, [contact_id, account_id, owner_id, stage, tier, last_touch, next_action_date, next_action_notes, ea_linked, sales_motion, notes, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM relationships WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
