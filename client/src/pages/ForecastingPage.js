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

function fmt(val) {
  if (!val && val !== 0) return '—';
  if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000)    return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
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

const TABS = ['Pipeline by Stage', 'Monthly Forecast', 'Resource Detail'];

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

  const totalRevenue  = forecast.reduce((s, r) => s + (r.total_value    || 0), 0);
  const totalWeighted = forecast.reduce((s, r) => s + (r.weighted_value || 0), 0);
  const totalFte      = forecast.reduce((s, r) => s + (r.total_fte      || 0), 0);
  const totalWFte     = forecast.reduce((s, r) => s + (r.weighted_fte   || 0), 0);

  const maxRev = resourcePlan.length ? Math.max(...resourcePlan.map(m => m.revenue))          : 1;
  const maxWRev= resourcePlan.length ? Math.max(...resourcePlan.map(m => m.weighted_revenue)) : 1;
  const maxFte = resourcePlan.length ? Math.max(...resourcePlan.map(m => m.fte))              : 1;

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

      {/* ── Tab 2: Monthly Forecast ── */}
      {tab === 'Monthly Forecast' && (
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
                  <span><span className="dot-swatch" style={{ background: 'var(--gold)' }} /> Weighted Revenue</span>
                  <span><span className="dot-swatch" style={{ background: 'var(--blue)' }} /> Total Revenue</span>
                  <span><span className="dot-swatch" style={{ background: '#a371f7' }} /> Weighted FTE (×$10k scale)</span>
                </div>
                <div className="chart-bars">
                  {resourcePlan.map(m => (
                    <div key={m.month} className="chart-col">
                      <div className="chart-stacked">
                        <div className="chart-bar-wrap" title={`Total: ${fmt(m.revenue)}`}>
                          <div className="chart-bar" style={{ height: `${(m.revenue / maxRev) * 140}px`, background: 'var(--blue)', opacity: 0.4 }} />
                        </div>
                        <div className="chart-bar-wrap" title={`Weighted: ${fmt(m.weighted_revenue)}`}>
                          <div className="chart-bar" style={{ height: `${(m.weighted_revenue / maxRev) * 140}px`, background: 'var(--gold)' }} />
                        </div>
                        <div className="chart-bar-wrap" title={`Wtd FTE: ${fmtFte(m.weighted_fte)}`}>
                          <div className="chart-bar" style={{ height: `${(m.weighted_fte / maxFte) * 140}px`, background: '#a371f7', opacity: 0.7 }} />
                        </div>
                      </div>
                      <div className="chart-label">{fmtMonth(m.month)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary table */}
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Total Revenue</th>
                      <th>Weighted Revenue</th>
                      <th style={{ width: 140 }}></th>
                      <th>FTE Demand</th>
                      <th>Weighted FTE</th>
                      <th style={{ width: 140 }}></th>
                      <th>Engagements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resourcePlan.map(m => {
                      const isOpen = expandedMonth === m.month;
                      return [
                        <tr
                          key={m.month}
                          className="month-row"
                          onClick={() => setExpandedMonth(isOpen ? null : m.month)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="fw">{fmtMonth(m.month)}</td>
                          <td>{fmt(m.revenue)}</td>
                          <td className="gold fw">{fmt(m.weighted_revenue)}</td>
                          <td><HBar value={m.weighted_revenue} max={maxWRev} color="var(--gold)" /></td>
                          <td>{fmtFte(m.fte)}</td>
                          <td className="gold fw">{fmtFte(m.weighted_fte)}</td>
                          <td><HBar value={m.weighted_fte} max={maxFte} color="#a371f7" /></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {m.opportunities.length} {isOpen ? '▲' : '▼'}
                          </td>
                        </tr>,
                        isOpen && m.opportunities.map((o, i) => (
                          <tr key={`${m.month}-${i}`} className="month-detail-row">
                            <td style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 12 }}>{o.name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(o.revenue_slice)}</td>
                            <td style={{ fontSize: 12 }} className="gold">{fmt(o.weighted_revenue_slice)}</td>
                            <td />
                            <td style={{ fontSize: 12 }}>{fmtFte(o.fte)}</td>
                            <td style={{ fontSize: 12 }} className="gold">{fmtFte(o.weighted_fte)}</td>
                            <td />
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              <span className="stage-chip" style={{ background: STAGE_COLORS[o.stage] + '22', color: STAGE_COLORS[o.stage] }}>{o.stage}</span>
                            </td>
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

      {/* ── Tab 3: Resource Detail ── */}
      {tab === 'Resource Detail' && (
        lr ? <p className="loading">Loading...</p> :
        resourcePlan.length === 0
          ? (
            <div className="card">
              <p style={{ color: 'var(--text-muted)' }}>No data yet. Add start date, duration, and FTE/mo to opportunities.</p>
            </div>
          ) : resourcePlan.map(month => (
            <div key={month.month} className="card month-card">
              <div className="month-header">
                <div className="month-title">{fmtMonth(month.month)}</div>
                <div className="month-kpis">
                  <div className="month-kpi">
                    <span className="month-kpi-label">Revenue</span>
                    <span className="month-kpi-value">{fmt(month.revenue)}</span>
                    <span className="month-kpi-sub">({fmt(month.weighted_revenue)} wtd)</span>
                  </div>
                  <div className="month-kpi">
                    <span className="month-kpi-label">FTE Demand</span>
                    <span className="month-kpi-value gold">{fmtFte(month.fte)}</span>
                    <span className="month-kpi-sub">({fmtFte(month.weighted_fte)} wtd)</span>
                  </div>
                </div>
                <div className="month-minibars">
                  <div className="minibar-row"><span>Rev</span><HBar value={month.revenue} max={maxRev} color="var(--blue)" /><span>{fmt(month.revenue)}</span></div>
                  <div className="minibar-row"><span>FTE</span><HBar value={month.fte} max={maxFte} color="var(--gold)" /><span>{fmtFte(month.fte)}</span></div>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Opportunity</th><th>Account</th><th>Stage</th><th>Service Line</th>
                    <th>Owner</th><th>FTE/mo</th><th>Wtd FTE</th><th>Rev/mo</th><th>$/FTE/mo</th><th>Wtd Rev</th>
                  </tr>
                </thead>
                <tbody>
                  {month.opportunities.map((o, i) => (
                    <tr key={i}>
                      <td className="fw">{o.name}</td>
                      <td className="muted">{o.account_name || '—'}</td>
                      <td><span className="stage-chip" style={{ background: STAGE_COLORS[o.stage] + '22', color: STAGE_COLORS[o.stage] }}>{o.stage}</span></td>
                      <td className="muted small">{o.service_line || '—'}</td>
                      <td className="muted small">{o.owner_name || '—'}</td>
                      <td className="fw">{fmtFte(o.fte)}</td>
                      <td className="gold">{fmtFte(o.weighted_fte)}</td>
                      <td>{fmt(o.revenue_slice)}</td>
                      <td className="muted small">{o.billing_rate ? fmt(o.billing_rate) : '—'}</td>
                      <td className="gold fw">{fmt(o.weighted_revenue_slice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
      )}
    </div>
  );
}
