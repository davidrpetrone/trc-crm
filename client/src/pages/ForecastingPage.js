import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import './ForecastingPage.css';

const STAGE_COLORS = {
  'Qualified':               '#388bfd',
  'Discovery':               '#3fb950',
  'Solution Shaping':        '#d4a843',
  'Proposal in Development': '#e36209',
  'Proposal Delivered':      '#f78166',
  'Verbal Alignment':        '#a371f7',
};

const CHART_HEIGHT = 150;

function fmt(val) {
  if (!val && val !== 0) return '—';
  return '$' + Math.round(val).toLocaleString();
}
function fmtFte(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toFixed(1);
}
function fmtMonth(ym) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('default', { month: 'short', year: 'numeric' });
}

function HBar({ value, max, color, height = 8 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="hbar-bg" style={{ height }}>
      <div className="hbar-fill" style={{ width: `${pct}%`, background: color, height }} />
    </div>
  );
}

const TABS = ['Pipeline by Stage', 'Revenue Outlook'];

export default function ForecastingPage() {
  const [tab, setTab] = useState('Pipeline by Stage');
  const [expandedMonth, setExpandedMonth] = useState(null);

  const { data: forecast = [], isLoading: lf } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.get('/opportunities/forecast').then(r => r.data),
  });

  const { data: resourcePlan = [], isLoading: lr } = useQuery({
    queryKey: ['resource-plan'],
    queryFn: () => api.get('/opportunities/resource-plan').then(r => r.data),
  });

  // Fetch financial inputs for years covered in resource plan
  const years = [...new Set(resourcePlan.map(m => m.month.split('-')[0]))];
  const primaryYear = years[0] || new Date().getFullYear();

  const { data: finInputs = [] } = useQuery({
    queryKey: ['financial-inputs', primaryYear],
    queryFn: () => api.get(`/financial-inputs?year=${primaryYear}`).then(r => r.data),
    enabled: resourcePlan.length > 0,
  });

  // Build lookup: "YYYY-MM" → { target, prior }
  const finMap = {};
  finInputs.forEach(r => {
    const key = `${r.year}-${String(r.month).padStart(2, '0')}`;
    finMap[key] = { target: r.target_revenue || 0, prior: r.prior_year_revenue || 0 };
  });

  const totalRevenue  = forecast.reduce((s, r) => s + (r.total_value    || 0), 0);
  const totalWeighted = forecast.reduce((s, r) => s + (r.weighted_value || 0), 0);
  const totalFte      = forecast.reduce((s, r) => s + (r.total_fte      || 0), 0);
  const totalWFte     = forecast.reduce((s, r) => s + (r.weighted_fte   || 0), 0);

  // For Revenue Outlook chart scale — include targets and prior year in max calc
  const maxPlanRev = resourcePlan.length ? Math.max(...resourcePlan.map(m => m.weighted_revenue)) : 1;
  const maxTargetRev = Object.values(finMap).reduce((m, v) => Math.max(m, v.target), 0);
  const maxPriorRev = Object.values(finMap).reduce((m, v) => Math.max(m, v.prior), 0);
  const maxRev = Math.max(maxPlanRev, maxTargetRev, maxPriorRev, 1);

  const maxWRev = resourcePlan.length ? Math.max(...resourcePlan.map(m => m.weighted_revenue)) : 1;
  const maxFte  = resourcePlan.length ? Math.max(...resourcePlan.map(m => m.weighted_fte))      : 1;

  return (
    <div className="forecast-page">
      <h1 className="page-title">Forecasting</h1>

      {/* KPI row */}
      <div className="kpi-row">
        <div className="card kpi-card">
          <div className="kpi-label">Pipeline Value</div>
          <div className="kpi-value">{fmt(totalRevenue)}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Weighted Revenue</div>
          <div className="kpi-value gold">{fmt(totalWeighted)}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Total FTE Demand</div>
          <div className="kpi-value">{fmtFte(totalFte)} <span className="kpi-unit">FTE/mo</span></div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Weighted FTE</div>
          <div className="kpi-value gold">{fmtFte(totalWFte)} <span className="kpi-unit">FTE/mo</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-row">
        {TABS.map(t => (
          <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── Tab 1: Pipeline by Stage ── */}
      {tab === 'Pipeline by Stage' && (
        <div className="card" style={{ padding: 0 }}>
          {lf ? <p className="loading">Loading...</p> : forecast.length === 0
            ? <p className="loading">No open opportunities.</p>
            : (
              <table>
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Count</th>
                    <th>Total Value</th>
                    <th>Weighted Revenue</th>
                    <th style={{ width: 130 }}></th>
                    <th>FTE / Mo</th>
                    <th>Weighted FTE</th>
                    <th style={{ width: 130 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map(r => (
                    <tr key={r.stage}>
                      <td>
                        <span className="stage-chip" style={{ background: STAGE_COLORS[r.stage] + '22', color: STAGE_COLORS[r.stage] }}>
                          {r.stage}
                        </span>
                      </td>
                      <td>{r.count}</td>
                      <td>{fmt(r.total_value)}</td>
                      <td className="gold fw">{fmt(r.weighted_value)}</td>
                      <td><HBar value={r.weighted_value} max={totalWeighted} color={STAGE_COLORS[r.stage]} /></td>
                      <td>{fmtFte(r.total_fte)}</td>
                      <td className="gold fw">{fmtFte(r.weighted_fte)}</td>
                      <td><HBar value={r.weighted_fte} max={totalWFte} color={STAGE_COLORS[r.stage]} /></td>
                    </tr>
                  ))}
                  <tr className="totals-row">
                    <td><strong>Total</strong></td>
                    <td><strong>{forecast.reduce((s, r) => s + r.count, 0)}</strong></td>
                    <td><strong>{fmt(totalRevenue)}</strong></td>
                    <td className="gold"><strong>{fmt(totalWeighted)}</strong></td>
                    <td />
                    <td><strong>{fmtFte(totalFte)}</strong></td>
                    <td className="gold"><strong>{fmtFte(totalWFte)}</strong></td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* ── Tab 2: Revenue Outlook ── */}
      {tab === 'Revenue Outlook' && (
        lr ? <p className="loading">Loading...</p> :
        resourcePlan.length === 0
          ? (
            <div className="card">
              <p style={{ color: 'var(--text-muted)' }}>
                No monthly forecast yet. Add opportunities with <strong>Start Date</strong>, <strong>Duration (weeks)</strong>, and <strong>FTE / Month</strong> to generate revenue projections.
              </p>
            </div>
          ) : (
            <>
              {/* Visual chart */}
              <div className="card monthly-chart">
                <div className="chart-legend">
                  <span><span className="dot-swatch" style={{ background: 'var(--gold)' }} /> Committed + Weighted Revenue</span>
                  <span><span className="line-swatch" style={{ color: '#f85149' }} /> Target Revenue</span>
                  <span><span className="line-swatch" style={{ color: '#8b949e' }} /> Prior Year Actual</span>
                </div>
                <div className="chart-bars">
                  {resourcePlan.map(m => {
                    const fin = finMap[m.month] || { target: 0, prior: 0 };
                    const barH = maxRev > 0 ? (m.weighted_revenue / maxRev) * CHART_HEIGHT : 0;
                    const targetH = maxRev > 0 && fin.target > 0 ? (fin.target / maxRev) * CHART_HEIGHT : null;
                    const priorH = maxRev > 0 && fin.prior > 0 ? (fin.prior / maxRev) * CHART_HEIGHT : null;
                    return (
                      <div key={m.month} className="chart-col">
                        <div className="chart-stacked" title={`${fmtMonth(m.month)}\nCommitted+Weighted: ${fmt(m.weighted_revenue)}${fin.target ? '\nTarget: ' + fmt(fin.target) : ''}${fin.prior ? '\nPrior Year: ' + fmt(fin.prior) : ''}`}>
                          <div className="chart-bar-wrap">
                            <div className="chart-bar" style={{ height: `${Math.max(2, barH)}px`, background: 'var(--gold)' }} />
                          </div>
                          {targetH !== null && (
                            <div className="overlay-marker overlay-target" style={{ bottom: `${targetH}px` }} />
                          )}
                          {priorH !== null && (
                            <div className="overlay-marker overlay-prior" style={{ bottom: `${priorH}px` }} />
                          )}
                        </div>
                        <div className="chart-label">{fmtMonth(m.month)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary table */}
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Forecasted Revenue</th>
                      <th style={{ width: 140 }}></th>
                      <th>Revenue Target</th>
                      <th>Prior Year Actual</th>
                      <th>Engagements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourcePlan.map(m => {
                      const isOpen = expandedMonth === m.month;
                      const fin = finMap[m.month] || { target: 0, prior: 0 };
                      return [
                        <tr
                          key={m.month}
                          className="month-row"
                          onClick={() => setExpandedMonth(isOpen ? null : m.month)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="fw">{fmtMonth(m.month)}</td>
                          <td className="gold fw">{fmt(m.weighted_revenue)}</td>
                          <td><HBar value={m.weighted_revenue} max={maxWRev} color="var(--gold)" /></td>
                          <td style={{ color: fin.target ? '#f85149' : 'var(--text-muted)' }}>
                            {fin.target > 0 ? fmt(fin.target) : '—'}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {fin.prior > 0 ? fmt(fin.prior) : '—'}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {m.opportunities.length} {isOpen ? '▲' : '▼'}
                          </td>
                        </tr>,
                        isOpen && m.opportunities.map((o, i) => (
                          <tr key={`${m.month}-${i}`} className="month-detail-row">
                            <td style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 12 }}>{o.name}</td>
                            <td style={{ fontSize: 12 }} className="gold">{fmt(o.weighted_revenue_slice)}</td>
                            <td />
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.account_name || '—'}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              <span className="stage-chip" style={{ background: (STAGE_COLORS[o.stage] || '#8b949e') + '22', color: STAGE_COLORS[o.stage] || '#8b949e' }}>{o.stage}</span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.owner_name || '—'}</td>
                          </tr>
                        ))
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
      )}
    </div>
  );
}
