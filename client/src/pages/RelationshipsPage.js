import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import RelationshipModal from '../components/RelationshipModal';
import { formatDistanceToNow, parseISO, isPast } from 'date-fns';
import './RelationshipsPage.css';

const STAGES = [
  'Target Identified',
  'Relationship Active',
  'Relationship Developing',
  'Commercial Signal Observed',
  'Convert to Opportunity',
];

const STAGE_COLORS = {
  'Target Identified':          { bg: '#388bfd22', text: '#388bfd' },
  'Relationship Active':        { bg: '#3fb95022', text: '#3fb950' },
  'Relationship Developing':    { bg: '#d4a84322', text: '#d4a843' },
  'Commercial Signal Observed': { bg: '#e3620922', text: '#e36209' },
  'Convert to Opportunity':     { bg: '#a371f722', text: '#a371f7' },
};

const TIER_COLORS = { A: '#3fb950', B: '#d4a843', C: '#8b949e' };

export default function RelationshipsPage() {
  const qc = useQueryClient();
  const [filterStage, setFilterStage] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: relationships = [], isLoading } = useQuery({
    queryKey: ['relationships'],
    queryFn: () => api.get('/relationships').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/relationships/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relationships'] }),
  });

  function handleEdit(rel) {
    setEditing(rel);
    setModalOpen(true);
  }

  function handleAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function handleClose() {
    setModalOpen(false);
    setEditing(null);
  }

  const filtered = relationships.filter(r => {
    if (filterStage && r.stage !== filterStage) return false;
    if (filterTier && r.tier !== filterTier) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.contact_name?.toLowerCase().includes(q) &&
        !r.account_name?.toLowerCase().includes(q) &&
        !r.owner_name?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s] = relationships.filter(r => r.stage === s).length;
    return acc;
  }, {});

  return (
    <div className="rel-page">
      <div className="page-header">
        <h1 className="page-title">Relationships</h1>
        <button className="btn-primary" onClick={handleAdd}>+ Add Relationship</button>
      </div>

      {/* Stage summary bar */}
      <div className="stage-bar">
        {STAGES.map(s => (
          <button
            key={s}
            className={'stage-bar-item' + (filterStage === s ? ' active' : '')}
            style={filterStage === s ? { borderColor: STAGE_COLORS[s].text, color: STAGE_COLORS[s].text } : {}}
            onClick={() => setFilterStage(filterStage === s ? '' : s)}
          >
            <span className="stage-bar-count" style={{ color: STAGE_COLORS[s].text }}>{stageCounts[s]}</span>
            <span className="stage-bar-label">{s}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-row">
        <input
          type="text"
          placeholder="Search contact, account, owner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)} style={{ width: 100 }}>
          <option value="">All Tiers</option>
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
          <option value="C">Tier C</option>
        </select>
        {(filterStage || filterTier || search) && (
          <button className="btn-secondary" onClick={() => { setFilterStage(''); setFilterTier(''); setSearch(''); }}>
            Clear filters
          </button>
        )}
        <span className="filter-count">{filtered.length} of {relationships.length}</span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 20, color: 'var(--text-muted)' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 20, color: 'var(--text-muted)' }}>No relationships found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Account</th>
                <th>Tier</th>
                <th>Stage</th>
                <th>Owner</th>
                <th>Last Touch</th>
                <th>Next Action</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const overdue = r.next_action_date && isPast(parseISO(r.next_action_date));
                const stale = !r.last_touch || isPast(new Date(new Date(r.last_touch).getTime() + 30 * 86400000));
                return (
                  <tr key={r.id} className={overdue ? 'row-overdue' : ''}>
                    <td>
                      <div className="contact-cell">
                        <span className="contact-name">{r.contact_name}</span>
                        {r.contact_title && <span className="contact-title">{r.contact_title}</span>}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.account_name || '—'}</td>
                    <td>
                      {r.tier && (
                        <span className="tier-badge" style={{ color: TIER_COLORS[r.tier] }}>
                          {r.tier}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="stage-chip" style={{ background: STAGE_COLORS[r.stage]?.bg, color: STAGE_COLORS[r.stage]?.text }}>
                        {r.stage}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.owner_name || '—'}</td>
                    <td style={{ color: stale ? 'var(--warning)' : 'var(--text-muted)', fontSize: 12 }}>
                      {r.last_touch
                        ? formatDistanceToNow(parseISO(r.last_touch), { addSuffix: true })
                        : <span style={{ color: 'var(--danger)' }}>Never</span>}
                    </td>
                    <td>
                      {r.next_action_date ? (
                        <div className="next-action-cell">
                          <span style={{ color: overdue ? 'var(--danger)' : 'var(--text)', fontSize: 12 }}>
                            {r.next_action_date}
                          </span>
                          {r.next_action_notes && (
                            <span className="next-action-notes">{r.next_action_notes}</span>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => handleEdit(r)}>Edit</button>
                        <button
                          className="btn-danger"
                          style={{ padding: '4px 10px' }}
                          onClick={() => { if (window.confirm(`Delete relationship with ${r.contact_name}?`)) deleteMutation.mutate(r.id); }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <RelationshipModal
          relationship={editing}
          onClose={handleClose}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['relationships'] }); handleClose(); }}
        />
      )}
    </div>
  );
}
