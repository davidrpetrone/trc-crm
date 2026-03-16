import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { formatDistanceToNow, parseISO } from 'date-fns';
import './DashboardPage.css';

const STAGE_COLORS = {
  'Target Identified': '#388bfd',
  'Relationship Active': '#3fb950',
  'Relationship Developing': '#d4a843',
  'Commercial Signal Observed': '#e36209',
  'Convert to Opportunity': '#a371f7',
  'Qualified': '#388bfd',
  'Discovery': '#3fb950',
  'Solution Shaping': '#d4a843',
  'Proposal in Development': '#e36209',
  'Proposal Delivered': '#f78166',
  'Verbal Alignment': '#a371f7',
  'Closed Won': '#3fb950',
  'Closed Lost': '#f85149',
  'Closed Deferred': '#8b949e',
};

export default function DashboardPage() {
  const { data: stale = [] } = useQuery({
    queryKey: ['relationships', 'stale'],
    queryFn: () => api.get('/relationships/stale').then(r => r.data),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.get('/opportunities').then(r => r.data),
  });

  const { data: forecast = [] } = useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.get('/opportunities/forecast').then(r => r.data),
  });

  const activeOpps = opportunities.filter(o => !['Closed Won', 'Closed Lost', 'Closed Deferred'].includes(o.stage));
  const totalWeighted = forecast.reduce((s, r) => s + (r.weighted_value || 0), 0);
  const totalPipeline = forecast.reduce((s, r) => s + (r.total_value || 0), 0);

  return (
    <div className="dashboard">
      <h1 className="page-title">Dashboard</h1>

      <div className="stat-row">
        <div className="card stat-card">
          <div className="stat-label">Active Relationships</div>
          <div className="stat-value">{stale.length > 0 ? '⚠ ' : ''}{stale.length} stale</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Open Opportunities</div>
          <div className="stat-value">{activeOpps.length}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Pipeline Value</div>
          <div className="stat-value">${(totalPipeline / 1000).toFixed(0)}k</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Weighted Forecast</div>
          <div className="stat-value">${(totalWeighted / 1000).toFixed(0)}k</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h2 className="section-title">Stale Relationships</h2>
          {stale.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>No stale relationships.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Account</th>
                  <th>Stage</th>
                  <th>Last Touch</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {stale.slice(0, 10).map(r => (
                  <tr key={r.id}>
                    <td>{r.contact_name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.account_name}</td>
                    <td>
                      <span className="stage-chip" style={{ background: STAGE_COLORS[r.stage] + '22', color: STAGE_COLORS[r.stage] }}>
                        {r.stage}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {r.last_touch ? formatDistanceToNow(parseISO(r.last_touch), { addSuffix: true }) : 'Never'}
                    </td>
                    <td style={{ color: r.next_action_date < new Date().toISOString().slice(0, 10) ? 'var(--danger)' : 'var(--text)' }}>
                      {r.next_action_date || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="section-title">Pipeline by Stage</h2>
          {forecast.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>No open opportunities.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Count</th>
                  <th>Total Value</th>
                  <th>Weighted</th>
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
                    <td>${(r.total_value / 1000).toFixed(0)}k</td>
                    <td style={{ color: 'var(--gold)' }}>${(r.weighted_value / 1000).toFixed(0)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
