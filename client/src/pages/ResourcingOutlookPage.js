import { useQuery } from '@tanstack/react-query';
import api from '../api';

function fmt(val) {
  if (!val && val !== 0) return '—';
  return '$' + Math.round(val).toLocaleString();
}
function fmtFte(val) {
  if (!val && val !== 0) return '—';
  return Number(val).toFixed(1);
}
function fmtMonth(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const STAGE_COLORS = {
  'Qualified':               '#388bfd',
  'Discovery':               '#3fb950',
  'Solution Shaping':        '#d4a843',
  'Proposal in Development': '#e36209',
  'Proposal Delivered':      '#f78166',
  'Verbal Alignment':        '#a371f7',
};

export default function ResourcingOutlookPage() {
  const { data: months = [], isLoading } = useQuery({
    queryKey: ['resource-plan'],
    queryFn: () => api.get('/opportunities/resource-plan').then(r => r.data),
  });

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>;

  const maxFte = Math.max(...months.map(m => m.fte), 1);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Resourcing Outlook</h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Projected FTE demand across active pipeline opportunities
        </p>
      </div>

      {months.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
          No opportunities with start dates and durations set.
        </div>
      ) : (
        <>
          {/* Summary bar chart */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16,
              textTransform: 'uppercase', letterSpacing: '0.05em' }}>FTE by Month</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 120 }}>
              {months.map(m => {
                const h = Math.max(4, (m.fte / maxFte) * 100);
                const wh = Math.max(4, (m.weighted_fte / maxFte) * 100);
                return (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }}>
                      <div title={`Total: ${fmtFte(m.fte)} FTE`}
                        style={{ flex: 1, background: '#388bfd44', height: `${h}%`, borderRadius: '3px 3px 0 0', minHeight: 2 }} />
                      <div title={`Weighted: ${fmtFte(m.weighted_fte)} FTE`}
                        style={{ flex: 1, background: '#388bfd', height: `${wh}%`, borderRadius: '3px 3px 0 0', minHeight: 2 }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {fmtMonth(m.month).replace(' ', '\n')}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#388bfd44', marginRight: 4, borderRadius: 2 }} />Total FTE</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#388bfd', marginRight: 4, borderRadius: 2 }} />Weighted FTE</span>
            </div>
          </div>

          {/* Month-by-month breakdown */}
          {months.map(m => (
            <div key={m.month} className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{fmtMonth(m.month)}</div>
                <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Total: <strong style={{ color: 'var(--text)' }}>{fmtFte(m.fte)} FTE</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Weighted: <strong style={{ color: '#388bfd' }}>{fmtFte(m.weighted_fte)} FTE</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Revenue: <strong style={{ color: 'var(--gold)' }}>{fmt(m.revenue)}</strong>
                  </span>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Opportunity', 'Account', 'Stage', 'FTE', 'Wtd FTE', 'Billing Rate', 'Owner'].map(h => (
                      <th key={h} style={{ padding: '7px 14px', textAlign: 'left', fontSize: 11,
                        color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {m.opportunities.map((o, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 500, fontSize: 13 }}>{o.name}</td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontSize: 12 }}>{o.account_name || '—'}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600,
                          color: STAGE_COLORS[o.stage] || 'var(--text-muted)' }}>{o.stage}</span>
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 13 }}>{fmtFte(o.fte)}</td>
                      <td style={{ padding: '9px 14px', fontSize: 13, color: '#388bfd' }}>{fmtFte(o.weighted_fte)}</td>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {o.billing_rate ? fmt(o.billing_rate) + '/FTE' : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{o.owner_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
