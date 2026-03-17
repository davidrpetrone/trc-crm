const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /financial-inputs?year=YYYY  → 12 rows for that year
router.get('/', requireAuth, async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const { rows } = await pool.query(
      'SELECT year, month, target_revenue, prior_year_revenue FROM financial_inputs WHERE year=$1 ORDER BY month',
      [year]
    );
    const result = Array.from({ length: 12 }, (_, i) => {
      const existing = rows.find(r => r.month === i + 1);
      return existing || { year, month: i + 1, target_revenue: 0, prior_year_revenue: 0 };
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /financial-inputs/:year/:month  → upsert
router.put('/:year/:month', requireAuth, async (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const { target_revenue, prior_year_revenue } = req.body;
  try {
    await pool.query(`
      INSERT INTO financial_inputs (year, month, target_revenue, prior_year_revenue)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (year, month) DO UPDATE SET
        target_revenue = EXCLUDED.target_revenue,
        prior_year_revenue = EXCLUDED.prior_year_revenue
    `, [year, month, target_revenue ?? 0, prior_year_revenue ?? 0]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
