const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const NAME_EXPR = `TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(NULLIF(c.mi,''),' ') || ' ' || COALESCE(c.last_name,''))`;

const BASE_QUERY = `
  SELECT c.*,
    ${NAME_EXPR} AS name,
    a.name AS account_name,
    u.name AS trc_owner_name,
    COALESCE(c.is_active, true) AS is_active
  FROM contacts c
  LEFT JOIN accounts a ON a.id = c.account_id
  LEFT JOIN users u ON u.id = c.trc_owner_id
`;

router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY c.last_name, c.first_name`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE_QUERY} WHERE c.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  const {
    account_id, trc_owner_id, type, first_name, mi, last_name, title,
    email, linkedin, business_phone, mobile_phone,
    address, city, state, zip_code, country,
    executive_assistant, ea_email, overlap_flag, last_contact, notes
  } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO contacts (
        account_id, trc_owner_id, type, first_name, mi, last_name, title,
        email, linkedin, business_phone, mobile_phone,
        address, city, state, zip_code, country,
        executive_assistant, ea_email, overlap_flag, last_contact, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING id
    `, [
      account_id || null, trc_owner_id || null, type || 'Contact',
      first_name, mi, last_name, title,
      email, linkedin, business_phone, mobile_phone,
      address, city, state, zip_code, country || 'USA',
      executive_assistant, ea_email,
      overlap_flag ? 1 : 0,
      last_contact || null, notes
    ]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  const {
    account_id, trc_owner_id, type, first_name, mi, last_name, title,
    email, linkedin, business_phone, mobile_phone,
    address, city, state, zip_code, country,
    executive_assistant, ea_email, overlap_flag, last_contact, notes, is_active
  } = req.body;
  try {
    await pool.query(`
      UPDATE contacts SET
        account_id=$1, trc_owner_id=$2, type=$3, first_name=$4, mi=$5, last_name=$6, title=$7,
        email=$8, linkedin=$9, business_phone=$10, mobile_phone=$11,
        address=$12, city=$13, state=$14, zip_code=$15, country=$16,
        executive_assistant=$17, ea_email=$18, overlap_flag=$19, last_contact=$20, notes=$21,
        is_active=$22, updated_at=NOW()
      WHERE id=$23
    `, [
      account_id || null, trc_owner_id || null, type,
      first_name, mi, last_name, title,
      email, linkedin, business_phone, mobile_phone,
      address, city, state, zip_code, country,
      executive_assistant, ea_email,
      overlap_flag ? 1 : 0,
      last_contact || null, notes,
      is_active !== false,
      req.params.id
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/active', requireAuth, async (req, res) => {
  const { is_active } = req.body;
  try {
    await pool.query('UPDATE contacts SET is_active=$1, updated_at=NOW() WHERE id=$2', [is_active, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM contacts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
