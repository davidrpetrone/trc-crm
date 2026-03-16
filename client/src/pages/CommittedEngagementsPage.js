import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../api';
import OpportunityModal from '../components/OpportunityModal';

const COMMITTED_STAGES = ['Closed Won', 'On Hold', 'Active', 'Complete'];

const STAGE_COLORS = {
  'Closed Won': { bg: '#3fb95022', text: '#3fb950', border: '#3fb950' },
  'On Hold':    { bg: '#d4a84322', text: '#d4a843', border: '#d4a843' },
  'Active':     { bg: '#388bfd22', text: '#388bfd', border: '#388bfd' },
  'Complete':   { bg: '#8b949e22', text: '#8b949e', border: '#484f58' },
};

function fmt(val) {
  if (!val && val !== 0) return '—';
  return '$' + Math.round(val).toLocaleString();
}

export default function CommittedEngagementsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.get('/opportunities').then(r => r.data),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }) => api.put(`/opportunities/${id}`, { ...opportunities.find(o => o.id === id), stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });

  const committed = opportunities.filter(o => COMMITTED_STAGES.includes(o.stage));

  const filtered = committed.filter(o => {
    if (filterStage && o.stage !== filterStage) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !o.name?.toLowerCase().includes(q) &&
        !o.account_name?.toLowerCase().includes(q) &&
        !o.owner_name?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const stageCounts = COMMITTED_STAGES.reduce((acc, s) => {
    acc[s] = committed.filter(o => o.stage === s).length;
    return acc;
  }, {});

  const totalValue = committed
    .filter(o => o.stage === 'Active')
    .reduce((s, o) => s + (o.estimated_value || 0), 0);

  return (
    <div className="rel-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Committed Engagements</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {committed.length} engagement{committed.length !== 1 ? 's' : ''}
            {totalValue > 0 && <span> · <span style={{ color: '#3fb950' }}>{fmt(totalValue)} active</span></span>}
          </div>
        </div>
      </div>

      {/* Stage summary bar */}
      <div className="stage-bar">
        {COMMITTED_STAGES.map(s => (
          <button
            key={s}
            className={'stage-bar-item' + (filterStage === s ? ' active' : '')}
            style={filterStage === s ? { borderColor: STAGE_COLORS[s].border, color: STAGE_COLORS[s].text } : {}}
            onClick={() => setFilterStage(filterStage === s ? '' : s)}
          >
            <span className="stage-bar-count" style={{ color: STAGE_COLORS[s].text }}>{stageCounts[s]}</span>
            <span className="stage-bar-label">{s}</span>
          </button>
        ))}
      </div>

      <div className="filter-row">
        <input
          type="text"
          placeholder="Search name, account, owner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        {(search || filterStage) && (
          <button className="btn-secondary" onClick={() => { setSearch(''); setFilterStage(''); }}>Clear</button>
        )}
        <span className="filter-count">{filtered.length} of {committed.length}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 20, color: 'var(--text-muted)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 20, color: 'var(--text-muted)' }}>
            No committed engagements yet. Move an opportunity to "Closed Won" in the Pipeline to see it here.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Engagement</th>
                <th>Account</th>
                <th>Status</th>
                <th>Value</th>
                <th>Start</th>
                <th>Duration</th>
                <th>FTE/mo</th>
                <th>Owner</th>
                <th>Service Line</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const col = STAGE_COLORS[o.stage] || STAGE_COLORS['Closed Won'];
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 500 }}>{o.name}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{o.account_name || '—'}</td>
                    <td>
                      <select
                        value={o.stage}
                        onChange={e => stageMutation.mutate({ id: o.id, stage: e.target.value })}
                        style={{
                          background: col.bg, border: `1px solid ${col.border}`,
                          borderRadius: 6, color: col.text, padding: '3px 8px',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {COMMITTED_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{fmt(o.estimated_value)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.start_date || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.duration_weeks ? `${o.duration_weeks}w` : '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.fte_per_month ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.owner_name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.service_line || '—'}</td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px' }}
                        onClick={() => { setEditing(o); setModalOpen(true); }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <OpportunityModal
          opportunity={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['opportunities'] }); setModalOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
