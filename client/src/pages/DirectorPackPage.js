import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isPast, parseISO, isAfter, subDays, format } from 'date-fns';
import api from '../api';
import './DirectorPackPage.css';

const STAGE_COLORS = {
  'Target Identified':          { bg: '#388bfd22', text: '#388bfd' },
  'Relationship Active':        { bg: '#3fb95022', text: '#3fb950' },
  'Relationship Developing':    { bg: '#d4a84322', text: '#d4a843' },
  'Commercial Signal Observed': { bg: '#e3620922', text: '#e36209' },
  'Convert to Opportunity':     { bg: '#a371f722', text: '#a371f7' },
  'Qualified':                  { bg: '#388bfd22', text: '#388bfd' },
  'Discovery':                  { bg: '#3fb95022', text: '#3fb950' },
  'Solution Shaping':           { bg: '#d4a84322', text: '#d4a843' },
  'Proposal in Development':    { bg: '#e3620922', text: '#e36209' },
  'Proposal Delivered':         { bg: '#f7816622', text: '#f78166' },
  'Verbal Alignment':           { bg: '#a371f722', text: '#a371f7' },
  'Closed Won':                 { bg: '#3fb95022', text: '#3fb950' },
  'On Hold':                    { bg: '#d4a84322', text: '#d4a843' },
  'Active':                     { bg: '#388bfd22', text: '#388bfd' },
  'Complete':                   { bg: '#8b949e22', text: '#8b949e' },
};

const TIER_COLOR = { A: '#3fb950', B: '#d4a843', C: '#8b949e' };

const ACTIVE_PIPELINE = ['Qualified','Discovery','Solution Shaping','Proposal in Development','Proposal Delivered','Verbal Alignment'];

function fmt(val) {
  if (!val && val !== 0) return '—';
  return '$' + Math.round(val).toLocaleString();
}

function StageChip({ stage }) {
  const c = STAGE_COLORS[stage] || { bg: '#8b949e22', text: '#8b949e' };
  return <span className="stage-chip" style={{ background: c.bg, color: c.text }}>{stage}</span>;
}

export default function DirectorPackPage() {
  const [selectedDirectorId, setSelectedDirectorId] = useState(null);
  const today = new Date();

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const directors = users.filter(u => u.role === 'director');

  // Auto-select first director when loaded
  const effectiveDirectorId = selectedDirectorId ?? (directors[0]?.id ?? null);
  const selectedDirector = directors.find(u => u.id === effectiveDirectorId) || null;

  const { data: relationships = [], isLoading: loadingRel } = useQuery({
    queryKey: ['relationships', effectiveDirectorId],
    queryFn: () => effectiveDirectorId
      ? api.get(`/relationships?owner_id=${effectiveDirectorId}`).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!effectiveDirectorId,
  });

  const { data: opportunities = [], isLoading: loadingOpp } = useQuery({
    queryKey: ['opportunities', effectiveDirectorId],
    queryFn: () => effectiveDirectorId
      ? api.get(`/opportunities?owner_id=${effectiveDirectorId}`).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!effectiveDirectorId,
  });

  const thirtyDaysAgo = subDays(today, 30);

  const activeOpps = opportunities.filter(o => ACTIVE_PIPELINE.includes(o.stage));
  const committedOpps = opportunities.filter(o => !ACTIVE_PIPELINE.includes(o.stage) && !['Closed Lost','Closed Deferred'].includes(o.stage));

  const overdueActions = relationships
    .filter(r => r.next_action_date && isPast(parseISO(r.next_action_date)))
    .sort((a, b) => a.next_action_date.localeCompare(b.next_action_date));

  const staleRelationships = relationships
    .filter(r => !r.last_touch || !isAfter(parseISO(r.last_touch), thirtyDaysAgo))
    .filter(r => !overdueActions.find(o => o.contact_id === r.contact_id));

  const totalPipeline = activeOpps.reduce((s, o) => s + (o.estimated_value || 0), 0);
  const totalWeighted = activeOpps.reduce((s, o) => s + ((o.estimated_value || 0) * (o.confidence || 0) / 100), 0);

  const tierA = relationships.filter(r => r.tier === 'A');
  const tierB = relationships.filter(r => r.tier === 'B');

  const isLoading = loadingUsers || loadingRel || loadingOpp;

  return (
    <div className="dirpack-page">
      <div className="dirpack-header">
        <div>
          <h1 className="page-title">Director Pack</h1>
          <div className="dirpack-date">As of {format(today, 'MMMM d, yyyy')}</div>
        </div>
        <button className="btn-secondary" onClick={() => window.print()}>Print / Export PDF</button>
      </div>

      {/* Director selector buttons */}
      {loadingUsers ? (
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Loading directors...</p>
      ) : directors.length === 0 ? (
        <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            No directors found. Assign the <strong>director</strong> role to users in User Profiles.
          </p>
        </div>
      ) : (
        <div className="director-tabs">
          {directors.map(d => (
            <button
              key={d.id}
              className={`director-tab${effectiveDirectorId === d.id ? ' active' : ''}`}
              onClick={() => setSelectedDirectorId(d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {!selectedDirector ? null : isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <>
          {/* Summary bar */}
          <div className="summary-bar">
            <SummaryCard label="Active Relationships" value={relationships.length} accent="var(--blue)" />
            <SummaryCard label="Tier A" value={tierA.length} accent="#3fb950" />
            <SummaryCard label="Tier B" value={tierB.length} accent="#d4a843" />
            <SummaryCard label="Overdue Actions" value={overdueActions.length} accent={overdueActions.length ? '#f85149' : '#3fb950'} />
            <SummaryCard label="Open Opportunities" value={activeOpps.length} accent="var(--gold)" />
            <SummaryCard label="Weighted Forecast" value={fmt(totalWeighted)} accent="var(--gold)" />
          </div>

          <div className="dirpack-grid">
            {/* Left column — Relationships */}
            <div className="dirpack-col">

              {overdueActions.length > 0 && (
                <Section title="Overdue Actions" accent="#f85149" count={overdueActions.length}>
                  <table>
                    <thead><tr><th>Contact</th><th>Account</th><th>Stage</th><th>Due</th><th>Action</th></tr></thead>
                    <tbody>
                      {overdueActions.map(r => (
                        <tr key={r.contact_id}>
                          <td className="fw">{r.contact_name}</td>
                          <td className="muted">{r.account_name || '—'}</td>
                          <td><StageChip stage={r.stage} /></td>
                          <td style={{ color: '#f85149', fontSize: 12 }}>{r.next_action_date}</td>
                          <td className="muted small">{r.next_action_notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              <Section title={`All Active Relationships (${relationships.length})`} accent="var(--blue)">
                {relationships.length === 0
                  ? <p className="empty">No active relationships assigned to {selectedDirector.name}.</p>
                  : (
                    <table>
                      <thead>
                        <tr>
                          <th>Contact</th><th>Account</th><th>Tier</th><th>Stage</th><th>Last Touch</th><th>Next Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relationships.map(r => (
                          <tr key={r.contact_id || r.id}>
                            <td className="fw">{r.contact_name}</td>
                            <td className="muted">{r.account_name || '—'}</td>
                            <td style={{ color: TIER_COLOR[r.tier], fontWeight: 700 }}>{r.tier || '—'}</td>
                            <td><StageChip stage={r.stage} /></td>
                            <td className="muted small">{r.last_touch || 'Never'}</td>
                            <td className="muted small">
                              {r.next_action_date
                                ? `${r.next_action_date}${r.next_action_notes ? ' — ' + r.next_action_notes : ''}`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
              </Section>

              {staleRelationships.length > 0 && (
                <Section title="Stale — No Contact in 30+ Days" accent="#d29922" count={staleRelationships.length}>
                  <table>
                    <thead><tr><th>Contact</th><th>Account</th><th>Tier</th><th>Stage</th><th>Last Touch</th></tr></thead>
                    <tbody>
                      {staleRelationships.slice(0, 10).map(r => (
                        <tr key={r.contact_id || r.id}>
                          <td className="fw">{r.contact_name}</td>
                          <td className="muted">{r.account_name || '—'}</td>
                          <td style={{ color: TIER_COLOR[r.tier], fontWeight: 700 }}>{r.tier || '—'}</td>
                          <td><StageChip stage={r.stage} /></td>
                          <td className="muted small">{r.last_touch || 'Never'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}
            </div>

            {/* Right column — Pipeline */}
            <div className="dirpack-col">

              <Section title="Pipeline Snapshot" accent="var(--gold)">
                <div className="pipeline-kpis">
                  <div className="pip-kpi">
                    <div className="pip-kpi-label">Total Pipeline</div>
                    <div className="pip-kpi-value">{fmt(totalPipeline)}</div>
                  </div>
                  <div className="pip-kpi">
                    <div className="pip-kpi-label">Weighted Forecast</div>
                    <div className="pip-kpi-value" style={{ color: 'var(--gold)' }}>{fmt(totalWeighted)}</div>
                  </div>
                </div>
                {activeOpps.length > 0 && (
                  <table style={{ marginTop: 12 }}>
                    <thead><tr><th>Opportunity</th><th>Account</th><th>Stage</th><th>Value</th><th>Close</th></tr></thead>
                    <tbody>
                      {activeOpps
                        .sort((a, b) => (a.close_date || '').localeCompare(b.close_date || ''))
                        .map(o => (
                          <tr key={o.id}>
                            <td className="fw">{o.name}</td>
                            <td className="muted">{o.account_name || '—'}</td>
                            <td><StageChip stage={o.stage} /></td>
                            <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{fmt(o.estimated_value)}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.close_date || '—'}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                )}
                {activeOpps.length === 0 && (
                  <p className="empty">No open pipeline for {selectedDirector.name}.</p>
                )}
              </Section>

              {committedOpps.length > 0 && (
                <Section title="Committed Engagements" accent="#3fb950" count={committedOpps.length}>
                  <table>
                    <thead><tr><th>Engagement</th><th>Account</th><th>Status</th><th>Value</th><th>FTE/mo</th></tr></thead>
                    <tbody>
                      {committedOpps.map(o => (
                        <tr key={o.id}>
                          <td className="fw">{o.name}</td>
                          <td className="muted">{o.account_name || '—'}</td>
                          <td><StageChip stage={o.stage} /></td>
                          <td style={{ color: 'var(--text-muted)' }}>{fmt(o.estimated_value)}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{o.fte_per_month ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {relationships.filter(r => r.stage === 'Commercial Signal Observed' || r.stage === 'Convert to Opportunity').length > 0 && (
                <Section title="Commercial Signals" accent="#a371f7">
                  <table>
                    <thead><tr><th>Contact</th><th>Account</th><th>Stage</th><th>Next Action</th></tr></thead>
                    <tbody>
                      {relationships
                        .filter(r => r.stage === 'Commercial Signal Observed' || r.stage === 'Convert to Opportunity')
                        .map(r => (
                          <tr key={r.contact_id || r.id}>
                            <td className="fw">{r.contact_name}</td>
                            <td className="muted">{r.account_name || '—'}</td>
                            <td><StageChip stage={r.stage} /></td>
                            <td className="muted small">{r.next_action_notes || '—'}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </Section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, accent, count, children }) {
  return (
    <div className="dp-section card">
      <div className="dp-section-header" style={{ borderLeftColor: accent }}>
        <span className="dp-section-title">{title}</span>
        {count != null && <span className="dp-section-count">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="summary-card card">
      <div className="summary-value" style={{ color: accent }}>{value}</div>
      <div className="summary-label">{label}</div>
    </div>
  );
}
