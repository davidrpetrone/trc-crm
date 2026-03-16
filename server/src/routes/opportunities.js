const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const BASE_QUERY = `
  SELECT o.*,
    a.name AS account_name,
    TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(NULLIF(c.mi,''),'') || ' ' || COALESCE(c.last_name,'')) AS contact_name,
    u.name AS owner_name
  FROM opportunities o
  LEFT JOIN accounts a ON a.id = o.account_id
  LEFT JOIN contacts c ON c.id = o.contact_id
  LEFT JOIN users u ON u.id = o.owner_id
`;

const ACTIVE_STAGES = ['Qualified','Discovery','Solution Shaping','Proposal in Development','Proposal Delivered','Verbal Alignment'];

router.get('/', requireAuth, async (req, res) => {
  const { owner_id, stage } = req.query;
  const conditions = [], params = [];
  if (owner_id) { params.push(owner_id); conditions.push(`o.owner_id=$${params.length}`); }
  if (stage)    { params.push(stage);    conditions.push(`o.stage=$${params.length}`); }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  try {
    const { rows } = await pool.query(`${BASE_QUERY}${where} ORDER BY o.close_date ASC NULLS LAST, o.estimated_value DESC NULLS LAST`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/forecast', requireAuth, async (req, res) => {
  const placeholders = ACTIVE_STAGES.map((_, i) => `$${i + 1}`).join(',');
  try {
    const { rows } = await pool.query(`
      SELECT stage,
        COUNT(*)::int AS count,
        SUM(estimated_value) AS total_value,
        SUM(estimated_value * confidence / 100.0) AS weighted_value,
        SUM(fte_per_month) AS total_fte,
        SUM(fte_per_month * confidence / 100.0) AS weighted_fte
      FROM opportunities
      WHERE stage IN (${placeholders})
      GROUP BY stage
      ORDER BY CASE stage
        WHEN 'Qualified' THEN 1 WHEN 'Discovery' THEN 2 WHEN 'Solution Shaping' THEN 3
        WHEN 'Proposal in Development' THEN 4 WHEN 'Proposal Delivered' THEN 5
        WHEN 'Verbal Alignment' THEN 6
      END
    `, ACTIVE_STAGES);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/resource-plan', requireAuth, async (req, res) => {
  const placeholders = ACTIVE_STAGES.map((_, i) => `$${i + 1}`).join(',');
  try {
    const { rows: opps } = await pool.query(`
      SELECT o.id, o.name, a.name AS account_name, o.stage, o.estimated_value, o.confidence,
             o.fte_per_month, o.start_date, o.duration_weeks, o.service_line, u.name AS owner_name
      FROM opportunities o
      LEFT JOIN accounts a ON a.id = o.account_id
      LEFT JOIN users u ON u.id = o.owner_id
      WHERE o.stage IN (${placeholders})
        AND o.start_date IS NOT NULL AND o.start_date != ''
        AND o.duration_weeks IS NOT NULL AND o.duration_weeks > 0
    `, ACTIVE_STAGES);

    const months = {};
    function addMonth(key) {
      if (!months[key]) months[key] = { month: key, revenue: 0, weighted_revenue: 0, fte: 0, weighted_fte: 0, opportunities: [] };
    }

    for (const opp of opps) {
      const conf = (opp.confidence || 0) / 100;
      const fte = opp.fte_per_month || 0;
      const totalMonths = Math.max(1, Math.ceil((opp.duration_weeks || 0) / 4.33));
      const totalFteMonths = fte * totalMonths;
      const revenuePerMonth = totalFteMonths > 0
        ? fte * ((opp.estimated_value || 0) / totalFteMonths)
        : (opp.estimated_value || 0) / totalMonths;
      const billingRate = fte > 0 ? revenuePerMonth / fte : null;

      const start = new Date(opp.start_date);
      for (let i = 0; i < totalMonths; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        addMonth(key);
        months[key].revenue += revenuePerMonth;
        months[key].weighted_revenue += revenuePerMonth * conf;
        months[key].fte += fte;
        months[key].weighted_fte += fte * conf;
        months[key].opportunities.push({
          id: opp.id, name: opp.name, account_name: opp.account_name,
          stage: opp.stage, fte, weighted_fte: fte * conf,
          revenue_slice: revenuePerMonth, weighted_revenue_slice: revenuePerMonth * conf,
          billing_rate: billingRate, service_line: opp.service_line, owner_name: opp.owner_name,
        });
      }
    }

    res.json(Object.values(months).sort((a, b) => a.month.localeCompare(b.month)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`${BASE_QUERY} WHERE o.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  const { account_id, contact_id, owner_id, name, stage, sales_motion, estimated_value, confidence, service_line, close_date, start_date, duration_weeks, fte_per_month, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO opportunities
        (account_id,contact_id,owner_id,name,stage,sales_motion,estimated_value,confidence,service_line,close_date,start_date,duration_weeks,fte_per_month,notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id
    `, [
      account_id || null, contact_id || null, owner_id || null,
      name, stage || 'Qualified', sales_motion,
      estimated_value ?? null, confidence ?? null, service_line,
      close_date || null, start_date || null,
      duration_weeks ? Number(duration_weeks) : null,
      fte_per_month ? Number(fte_per_month) : null,
      notes
    ]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { account_id, contact_id, owner_id, name, stage, sales_motion, estimated_value, confidence, service_line, close_date, start_date, duration_weeks, fte_per_month, notes } = req.body;
  try {
    await pool.query(`
      UPDATE opportunities SET
        account_id=$1, contact_id=$2, owner_id=$3, name=$4, stage=$5, sales_motion=$6,
        estimated_value=$7, confidence=$8, service_line=$9, close_date=$10,
        start_date=$11, duration_weeks=$12, fte_per_month=$13, notes=$14, updated_at=NOW()
      WHERE id=$15
    `, [
      account_id || null, contact_id || null, owner_id || null,
      name, stage, sales_motion,
      estimated_value ?? null, confidence ?? null, service_line,
      close_date || null, start_date || null,
      duration_weeks ? Number(duration_weeks) : null,
      fte_per_month ? Number(fte_per_month) : null,
      notes, req.params.id
    ]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM opportunities WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
