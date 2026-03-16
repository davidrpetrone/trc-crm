import { useQuery } from '@tanstack/react-query';
import { isPast, parseISO, isAfter, subDays, subMonths, format } from 'date-fns';
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
};

const TIER_COLOR = { A: '#3fb950', B: '#d4a843', C: '#8b949e' };

function fmt(val) {
  if (!val && val !== 0) return '—';
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
}

function StageChip({ stage }) {
  const c = STAGE_COLORS[stage] || { bg: '#8b949e22', text: '#8b949e' };
  return <span className="stage-chip" style={{ background: c.bg, color: c.text }}>{stage}</span>;
}

export default function DirectorPackPage() {
  const { data: relationships = [], isLoading: loadingRel } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => api.get('/relationships').then(r => r.data),
  });

  const { data: opportunities = [], isLoading: loadingOpp } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.get('/opportunities').then(r => r.data),
  });

  const { data: forecast = [] } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.get('/opportunities/forecast').then(r => r.data),
  });

  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  const threeMonthsAgo = subMonths(today, 3);

  // --- Relationship sections ---
  const tierA = relationships.filter(r => r.tier === 'A');
  const tierB = relationships.filter(r => r.tier === 'B');

  const overdueActions = relationships.filter(r =>
    r.next_action_date && isPast(parseISO(r.next_action_date))
  ).sort((a, b) => a.next_action_date.localeCompare(b.next_action_date));

  const stale = relationships.filter(r =>
    !r.last_touch || !isAfter(parseISO(r.last_touch), thirtyDaysAgo)
  ).filter(r => !overdueActions.find(o => o.id === r.id));

  // --- Gaps ---
  const noOwner     = relationships.filter(r => !r.owner_id);
  const noNextAction = relationships.filter(r => !r.next_action_date && r.stage !== 'Convert to Opportunity');
  const noTier      = relationships.filter(r => !r.tier);

  // --- Pipeline ---
  const ACTIVE = ['Qualified','Discovery','Solution Shaping','Proposal in Development','Proposal Delivered','Verbal Alignment'];
  const activeOpps = opportunities.filter(o => ACTIVE.includes(o.stage));
  const totalWeighted = forecast.reduce((s, r) => s + (r.weighted_value || 0), 0);
  const totalPipeline = forecast.reduce((s, r) => s + (r.total_value || 0), 0);

  const upcomingClose = activeOpps
    .filter(o => o.close_date)
    .sort((a, b) => a.close_date.localeCompare(b.close_date))
    .slice(0, 5);

  const isLoading = loadingRel || loadingOpp;

  return (
    <div className="dirpack-page">
      <div className="dirpack-header">
        <div>
          <h1 className="page-title">Director Pack</h1>
          <div className="dirpack-date">As of {format(today, 'MMMM d, yyyy')}</div>
        </div>
        <button className="btn-secondary" onClick={() => window.print()}>Print / Export PDF</button>
      </div>

      {isLoading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : (
        <>
          {/* Summary bar */}
          <div className="summary-bar">
            <SummaryCard label="Tier A Relationships" value={tierA.length} accent="#3fb950" />
            <SummaryCard label="Tier B Relationships" value={tierB.length} accent="#d4a843" />
            <SummaryCard label="Overdue Actions" value={overdueActions.length} accent={overdueActions.length ? '#f85149' : '#3fb950'} />
            <SummaryCard label="Stale (30+ days)" value={stale.length} accent={stale.length ? '#d29922' : '#3fb950'} />
            <SummaryCard label="Open Opportunities" value={activeOpps.length} accent="var(--gold)" />
            <SummaryCard label="Weighted Forecast" value={fmt(totalWeighted)} accent="var(--gold)" />
          </div>

          <div className="dirpack-grid">
            {/* Left column */}
            <div className="dirpack-col">

              {/* Overdue Actions */}
              {overdueActions.length > 0 && (
                <Section title="Overdue Actions" accent="#f85149" count={overdueActions.length}>
                  <table>
                    <thead><tr><th>Contact</th><th>Account</th><th>Stage</th><th>Due</th><th>Action</th></tr></thead>
                    <tbody>
                      {overdueActions.map(r => (
                        <tr key={r.id}>
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

              {/* Tier A */}
              <Section title="Tier A Relationships" accent="#3fb950" count={tierA.length}>
                {tierA.length === 0
                  ? <p className="empty">No Tier A relationships.</p>
                  : <RelTable rows={tierA} />
                }
              </Section>

              {/* Tier B */}
              <Section title="Tier B Relationships" accent="#d4a843" count={tierB.length}>
                {tierB.length === 0
                  ? <p className="empty">No Tier B relationships.</p>
                  : <RelTable rows={tierB} />
                }
              </Section>

              {/* Stale */}
              {stale.length > 0 && (
                <Section title="Stale — No Contact in 30+ Days" accent="#d29922" count={stale.length}>
                  <RelTable rows={stale.slice(0, 10)} showLastTouch />
                </Section>
              )}
            </div>

            {/* Right column */}
            <div className="dirpack-col">

              {/* Pipeline snapshot */}
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
                {forecast.length > 0 && (
                  <table style={{ marginTop: 12 }}>
                    <thead><tr><th>Stage</th><th>Count</th><th>Value</th><th>Weighted</th></tr></thead>
                    <tbody>
                      {forecast.map(r => (
                        <tr key={r.stage}>
                          <td><StageChip stage={r.stage} /></td>
                          <td>{r.count}</td>
                          <td>{fmt(r.total_value)}</td>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{fmt(r.weighted_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>

              {/* Upcoming closes */}
              {upcomingClose.length > 0 && (
                <Section title="Upcoming Close Dates" accent="var(--blue)">
                  <table>
                    <thead><tr><th>Opportunity</th><th>Account</th><th>Stage</th><th>Close</th><th>Value</th></tr></thead>
                    <tbody>
                      {upcomingClose.map(o => (
                        <tr key={o.id}>
                          <td className="fw">{o.name}</td>
                          <td className="muted">{o.account_name || '—'}</td>
                          <td><StageChip stage={o.stage} /></td>
                          <td style={{ fontSize: 12 }}>{o.close_date}</td>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>{fmt(o.estimated_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* Gaps */}
              {(noOwner.length > 0 || noNextAction.length > 0 || noTier.length > 0) && (
                <Section title="Gaps to Address" accent="#f85149">
                  {noOwner.length > 0 && (
                    <GapRow label="No owner assigned" count={noOwner.length}
                      names={noOwner.slice(0, 4).map(r => r.contact_name)} />
                  )}
                  {noNextAction.length > 0 && (
                    <GapRow label="No next action set" count={noNextAction.length}
                      names={noNextAction.slice(0, 4).map(r => r.contact_name)} />
                  )}
                  {noTier.length > 0 && (
                    <GapRow label="No tier assigned" count={noTier.length}
                      names={noTier.slice(0, 4).map(r => r.contact_name)} />
                  )}
                </Section>
              )}

              {/* Commercial signals */}
              {relationships.filter(r => r.stage === 'Commercial Signal Observed' || r.stage === 'Convert to Opportunity').length > 0 && (
                <Section title="Commercial Signals" accent="#a371f7">
                  <RelTable rows={relationships.filter(r =>
                    r.stage === 'Commercial Signal Observed' || r.stage === 'Convert to Opportunity'
                  )} />
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

function RelTable({ rows, showLastTouch }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Contact</th>
          <th>Account</th>
          <th>Tier</th>
          <th>Stage</th>
          <th>Owner</th>
          {showLastTouch ? <th>Last Touch</th> : <th>Next Action</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td className="fw">{r.contact_name}</td>
            <td className="muted">{r.account_name || '—'}</td>
            <td style={{ color: TIER_COLOR[r.tier], fontWeight: 700 }}>{r.tier || '—'}</td>
            <td><StageChip stage={r.stage} /></td>
            <td className="muted small">{r.owner_name || '—'}</td>
            {showLastTouch
              ? <td className="muted small">{r.last_touch || 'Never'}</td>
              : <td className="muted small">{r.next_action_date ? `${r.next_action_date}${r.next_action_notes ? ' — ' + r.next_action_notes : ''}` : '—'}</td>
            }
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GapRow({ label, count, names }) {
  return (
    <div className="gap-row">
      <div className="gap-label">
        <span className="gap-count">{count}</span> {label}
      </div>
      <div className="gap-names">{names.join(', ')}{count > 4 ? ` +${count - 4} more` : ''}</div>
    </div>
  );
}
