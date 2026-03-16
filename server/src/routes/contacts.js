const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper: derive full name for backward-compat joins
const NAME_EXPR = `TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(NULLIF(c.mi,''),' ') || ' ' || COALESCE(c.last_name,''))`;

const BASE_QUERY = `
  SELECT c.*,
    ${NAME_EXPR} as name,
    a.name as account_name,
    u.name as trc_owner_name
  FROM contacts c
  LEFT JOIN accounts a ON a.id = c.account_id
  LEFT JOIN users u ON u.id = c.trc_owner_id
`;

router.get('/', requireAuth, (req, res) => {
  const contacts = getDb().prepare(`${BASE_QUERY} ORDER BY c.last_name, c.first_name`).all();
  res.json(contacts);
});

router.get('/:id', requireAuth, (req, res) => {
  const contact = getDb().prepare(`${BASE_QUERY} WHERE c.id=?`).get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Not found' });
  res.json(contact);
});

router.post('/', requireAuth, (req, res) => {
  const {
    account_id, type, first_name, mi, last_name, title,
    email, linkedin, business_phone, mobile_phone,
    address, city, state, zip_code, country,
    executive_assistant, ea_email, trc_owner_id,
    overlap_flag, last_contact, notes
  } = req.body;

  const result = getDb().prepare(`
    INSERT INTO contacts (
      account_id, type, first_name, mi, last_name, title,
      email, linkedin, business_phone, mobile_phone,
      address, city, state, zip_code, country,
      executive_assistant, ea_email, trc_owner_id,
      overlap_flag, last_contact, notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    account_id || null, type || 'Contact', first_name, mi, last_name, title,
    email, linkedin, business_phone, mobile_phone,
    address, city, state, zip_code, country,
    executive_assistant, ea_email, trc_owner_id || null,
    overlap_flag ? 1 : 0, last_contact, notes
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireAuth, (req, res) => {
  const {
    account_id, type, first_name, mi, last_name, title,
    email, linkedin, business_phone, mobile_phone,
    address, city, state, zip_code, country,
    executive_assistant, ea_email, trc_owner_id,
    overlap_flag, last_contact, notes
  } = req.body;

  getDb().prepare(`
    UPDATE contacts SET
      account_id=?, type=?, first_name=?, mi=?, last_name=?, title=?,
      email=?, linkedin=?, business_phone=?, mobile_phone=?,
      address=?, city=?, state=?, zip_code=?, country=?,
      executive_assistant=?, ea_email=?, trc_owner_id=?,
      overlap_flag=?, last_contact=?, notes=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    account_id || null, type || 'Contact', first_name, mi, last_name, title,
    email, linkedin, business_phone, mobile_phone,
    address, city, state, zip_code, country,
    executive_assistant, ea_email, trc_owner_id || null,
    overlap_flag ? 1 : 0, last_contact, notes,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
