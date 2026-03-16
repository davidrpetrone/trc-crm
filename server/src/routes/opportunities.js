const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const BASE_QUERY = `
  SELECT o.*,
    a.name as account_name,
    c.name as contact_name,
    u.name as owner_name
  FROM opportunities o
  LEFT JOIN accounts a ON a.id = o.account_id
  LEFT JOIN contacts c ON c.id = o.contact_id
  LEFT JOIN users u ON u.id = o.owner_id
`;

const ACTIVE_STAGES = [
  'Qualified','Discovery','Solution Shaping',
  'Proposal in Development','Proposal Delivered','Verbal Alignment'
];

router.get('/', requireAuth, (req, res) => {
  const { owner_id, stage } = req.query;
  let query = BASE_QUERY;
  const params = [];
  const conditions = [];
  if (owner_id) { conditions.push('o.owner_id = ?'); params.push(owner_id); }
  if (stage)    { conditions.push('o.stage = ?');    params.push(stage); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY o.close_date ASC, o.estimated_value DESC';
  res.json(getDb().prepare(query).all(...params));
});

// Stage-level forecast summary
router.get('/forecast', requireAuth, (req, res) => {
  const rows = getDb().prepare(`
    SELECT stage,
      COUNT(*) as count,
      SUM(estimated_value) as total_value,
      SUM(estimated_value * confidence / 100.0) as weighted_value,
      SUM(fte_per_month) as total_fte,
      SUM(fte_per_month * confidence / 100.0) as weighted_fte
    FROM opportunities
    WHERE stage IN (${ACTIVE_STAGES.map(() => '?').join(',')})
    GROUP BY stage
    ORDER BY CASE stage
      WHEN 'Qualified' THEN 1 WHEN 'Discovery' THEN 2 WHEN 'Solution Shaping' THEN 3
      WHEN 'Proposal in Development' THEN 4 WHEN 'Proposal Delivered' THEN 5
      WHEN 'Verbal Alignment' THEN 6
    END
  `).all(...ACTIVE_STAGES);
  res.json(rows);
});

// Monthly resource plan — spreads FTE demand and revenue across engagement months
router.get('/resource-plan', requireAuth, (req, res) => {
  const opps = getDb().prepare(`
    SELECT o.id, o.name, a.name as account_name, o.stage, o.estimated_value, o.confidence,
           o.fte_per_month, o.start_date, o.duration_weeks, o.service_line, u.name as owner_name
    FROM opportunities o
    LEFT JOIN accounts a ON a.id = o.account_id
    LEFT JOIN users u ON u.id = o.owner_id
    WHERE stage IN (${ACTIVE_STAGES.map(() => '?').join(',')})
      AND start_date IS NOT NULL AND start_date != ''
      AND duration_weeks IS NOT NULL AND duration_weeks > 0
  `).all(...ACTIVE_STAGES);

  // Build a map: { 'YYYY-MM': { revenue, weighted_revenue, fte, weighted_fte, opps[] } }
  const months = {};

  function addMonth(key) {
    if (!months[key]) months[key] = { month: key, revenue: 0, weighted_revenue: 0, fte: 0, weighted_fte: 0, opportunities: [] };
  }

  for (const opp of opps) {
    const conf = (opp.confidence || 0) / 100;
    const fte = opp.fte_per_month || 0;
    const totalMonths = Math.max(1, Math.ceil((opp.duration_weeks || 0) / 4.33));
    const totalFteMonths = fte * totalMonths;
    // Revenue proportional to FTE: rev/mo = fte/mo × (total_value / total_fte_months)
    // When FTE is constant this equals total_value / totalMonths
    const revenuePerMonth = totalFteMonths > 0
      ? fte * ((opp.estimated_value || 0) / totalFteMonths)
      : (opp.estimated_value || 0) / totalMonths;
    const billingRate = fte > 0 ? revenuePerMonth / fte : null; // $/FTE/month

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
        id: opp.id,
        name: opp.name,
        account_name: opp.account_name,
        stage: opp.stage,
        fte,
        weighted_fte: fte * conf,
        revenue_slice: revenuePerMonth,
        weighted_revenue_slice: revenuePerMonth * conf,
        billing_rate: billingRate,
        service_line: opp.service_line,
        owner_name: opp.owner_name,
      });
    }
  }

  const result = Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
  res.json(result);
});

router.get('/:id', requireAuth, (req, res) => {
  const row = getDb().prepare(`${BASE_QUERY} WHERE o.id=?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', requireAuth, (req, res) => {
  const {
    account_id, contact_id, owner_id, name, stage,
    sales_motion, estimated_value, confidence, service_line,
    close_date, start_date, duration_weeks, fte_per_month, notes
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const result = getDb().prepare(`
    INSERT INTO opportunities
      (account_id, contact_id, owner_id, name, stage, sales_motion,
       estimated_value, confidence, service_line, close_date,
       start_date, duration_weeks, fte_per_month, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    account_id || null, contact_id || null, owner_id || null,
    name, stage || 'Qualified', sales_motion,
    estimated_value ?? null, confidence ?? null, service_line,
    close_date || null, start_date || null,
    duration_weeks ? Number(duration_weeks) : null,
    fte_per_month ? Number(fte_per_month) : null,
    notes
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', requireAuth, (req, res) => {
  const {
    account_id, contact_id, owner_id, name, stage,
    sales_motion, estimated_value, confidence, service_line,
    close_date, start_date, duration_weeks, fte_per_month, notes
  } = req.body;

  getDb().prepare(`
    UPDATE opportunities SET
      account_id=?, contact_id=?, owner_id=?, name=?, stage=?, sales_motion=?,
      estimated_value=?, confidence=?, service_line=?, close_date=?,
      start_date=?, duration_weeks=?, fte_per_month=?, notes=?,
      updated_at=datetime('now')
    WHERE id=?
  `).run(
    account_id || null, contact_id || null, owner_id || null,
    name, stage, sales_motion,
    estimated_value ?? null, confidence ?? null, service_line,
    close_date || null, start_date || null,
    duration_weeks ? Number(duration_weeks) : null,
    fte_per_month ? Number(fte_per_month) : null,
    notes, req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  getDb().prepare('DELETE FROM opportunities WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
