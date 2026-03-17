import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import './ResourcingOutlookPage.css';

const CHART_HEIGHT = 150;

const STAGE_COLORS = {
  'Qualified':               '#388bfd',
  'Discovery':               '#3fb950',
  'Solution Shaping':        '#d4a843',
  'Proposal in Development': '#e36209',
  'Proposal Delivered':      '#f78166',
  'Verbal Alignment':        '#a371f7',
  'Closed Won':              '#3fb950',
  'On Hold':                 '#d4a843',
  'Active':                  '#388bfd',
  'Complete':                '#8b949e',
};

const COMMITTED_STAGES = ['Closed Won','On Hold','Active','Complete'];

function fmtFte(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toFixed(1);
}
function fmt(val) {
  if (!val && val !== 0) return '—';
  return '$' + Math.round(val).toLocaleString();
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

export default function ResourcingOutlookPage() {
  const [expandedMonth, setExpandedMonth] = useState(null);

  const { data: resourcePlan = [], isLoading } = useQuery({
    queryKey: ['resource-plan'],
    queryFn: () => api.get('/opportunities/resource-plan').then(r => r.data),
  });

  if (isLoading) return <div className="resourcing-page"><p className="loading">Loading...</p></div>;

  // Split committed vs pipeline FTEs per month
  const monthData = resourcePlan.map(m => {
    const committedFte = m.opportunities
      .filter(o => COMMITTED_STAGES.includes(o.stage))
      .reduce((s, o) => s + (o.fte || 0), 0);
    const weightedFte = m.weighted_fte;
    const pipelineFte = m.opportunities
      .filter(o => !COMMITTED_STAGES.includes(o.stage))
      .reduce((s, o) => s + (o.weighted_fte || 0), 0);
    return { ...m, committedFte, weightedPipelineFte: pipelineFte };
  });

  const totalCommittedFte = monthData.reduce((s, m) => s + m.committedFte, 0);
  const totalWeightedFte  = monthData.reduce((s, m) => s + m.weighted_fte, 0);
  const totalFte          = monthData.reduce((s, m) => s + m.fte, 0);
  const peakMonth         = monthData.reduce((peak, m) => m.weighted_fte > (peak?.weighted_fte || 0) ? m : peak, null);

  const maxFte = monthData.length ? Math.max(...monthData.map(m => m.fte), 1) : 1;
  const maxWFte = monthData.length ? Math.max(...monthData.map(m => m.weighted_fte), 1) : 1;

  return (
    <div className="resourcing-page">
      <h1 className="page-title">Resourcing Outlook</h1>

      {/* KPI row */}
      <div className="kpi-row">
        <div className="card kpi-card">
          <div className="kpi-label">Total FTE Demand</div>
          <div className="kpi-value">{fmtFte(totalFte)} <span className="kpi-unit">FTE/mo avg</span></div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Weighted FTE Demand</div>
          <div className="kpi-value gold">{fmtFte(totalWeightedFte)} <span className="kpi-unit">FTE/mo</span></div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Committed FTE</div>
          <div className="kpi-value" style={{ color: '#3fb950' }}>{fmtFte(totalCommittedFte)} <span className="kpi-unit">FTE/mo</span></div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Peak Month</div>
          <div className="kpi-value gold" style={{ fontSize: 20 }}>
            {peakMonth ? fmtFte(peakMonth.weighted_fte) : '—'} <span className="kpi-unit">FTE</span>
          </div>
          {peakMonth && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{fmtMonth(peakMonth.month)}</div>}
        </div>
      </div>

      {resourcePlan.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-muted)' }}>
            No resourcing data yet. Add opportunities with <strong>Start Date</strong>, <strong>Duration (weeks)</strong>, and <strong>FTE / Month</strong>.
          </p>
        </div>
      ) : (
        <>
          {/* Visual chart */}
          <div className="card monthly-chart">
            <div className="chart-legend">
              <span><span className="dot-swatch" style={{ background: 'var(--gold)' }} /> Weighted FTE Demand</span>
              <span><span className="dot-swatch" style={{ background: 'var(--blue)', opacity: 0.5 }} /> Total FTE Demand</span>
              <span><span style={{ display: 'inline-block', width: 18, borderTop: '2px dashed #3fb950', marginRight: 4, verticalAlign: 'middle' }} /> Committed FTE</span>
            </div>
            <div className="chart-bars">
              {monthData.map(m => {
                const totalBarH = maxFte > 0 ? (m.fte / maxFte) * CHART_HEIGHT : 0;
                const weightedBarH = maxFte > 0 ? (m.weighted_fte / maxFte) * CHART_HEIGHT : 0;
                const committedH = maxFte > 0 && m.committedFte > 0 ? (m.committedFte / maxFte) * CHART_HEIGHT : null;
                return (
                  <div key={m.month} className="chart-col">
                    <div
                      className="chart-stacked"
                      title={`${fmtMonth(m.month)}\nWeighted FTE: ${fmtFte(m.weighted_fte)}\nTotal FTE: ${fmtFte(m.fte)}\nCommitted: ${fmtFte(m.committedFte)}`}
                    >
                      <div className="chart-bar-wrap">
                        <div className="chart-bar" style={{ height: `${Math.max(2, totalBarH)}px`, background: 'var(--blue)', opacity: 0.35, width: 16 }} />
                      </div>
                      <div className="chart-bar-wrap">
                        <div className="chart-bar" style={{ height: `${Math.max(2, weightedBarH)}px`, background: 'var(--gold)', width: 14 }} />
                      </div>
                      {committedH !== null && (
                        <div className="overlay-marker overlay-committed" style={{ bottom: `${committedH}px` }} />
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
                  <th>Total FTE</th>
                  <th>Weighted FTE</th>
                  <th style={{ width: 140 }}></th>
                  <th>Committed FTE</th>
                  <th>Pipeline FTE (wtd)</th>
                  <th>Engagements</th>
                </tr>
              </thead>
              <tbody>
                {monthData.map(m => {
                  const isOpen = expandedMonth === m.month;
                  return [
                    <tr
                      key={m.month}
                      className="month-row"
                      onClick={() => setExpandedMonth(isOpen ? null : m.month)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="fw">{fmtMonth(m.month)}</td>
                      <td>{fmtFte(m.fte)}</td>
                      <td className="gold fw">{fmtFte(m.weighted_fte)}</td>
                      <td><HBar value={m.weighted_fte} max={maxWFte} color="var(--gold)" /></td>
                      <td style={{ color: '#3fb950', fontWeight: 600 }}>{fmtFte(m.committedFte)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{fmtFte(m.weightedPipelineFte)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {m.opportunities.length} {isOpen ? '▲' : '▼'}
                      </td>
                    </tr>,
                    isOpen && m.opportunities.map((o, i) => (
                      <tr key={`${m.month}-${i}`} className="month-detail-row">
                        <td style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 12 }}>{o.name}</td>
                        <td style={{ fontSize: 12 }}>{fmtFte(o.fte)}</td>
                        <td style={{ fontSize: 12 }} className="gold">{fmtFte(o.weighted_fte)}</td>
                        <td />
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.account_name || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          <span className="stage-chip" style={{ background: (STAGE_COLORS[o.stage] || '#8b949e') + '22', color: STAGE_COLORS[o.stage] || '#8b949e' }}>
                            {o.stage}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.owner_name || '—'}</td>
                      </tr>
                    ))
                  ];
                })}
                <tr className="totals-row">
                  <td><strong>Total</strong></td>
                  <td><strong>{fmtFte(totalFte)}</strong></td>
                  <td className="gold"><strong>{fmtFte(totalWeightedFte)}</strong></td>
                  <td />
                  <td style={{ color: '#3fb950', fontWeight: 700 }}>{fmtFte(totalCommittedFte)}</td>
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
