import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import OpportunityModal from '../components/OpportunityModal';
import './PipelinePage.css';

const ACTIVE_STAGES = [
  'Qualified',
  'Discovery',
  'Solution Shaping',
  'Proposal in Development',
  'Proposal Delivered',
  'Verbal Alignment',
];

const CLOSED_STAGES = ['Closed Won', 'Closed Lost', 'Closed Deferred'];

const ALL_BOARD_STAGES = [...ACTIVE_STAGES, ...CLOSED_STAGES];

// Sort order for list view: furthest progressed first, closed at bottom
const STAGE_SORT = {
  'Verbal Alignment': 0,
  'Proposal Delivered': 1,
  'Proposal in Development': 2,
  'Solution Shaping': 3,
  'Discovery': 4,
  'Qualified': 5,
  'Active': 6,
  'On Hold': 7,
  'Complete': 8,
  'Closed Won': 9,
  'Closed Lost': 10,
  'Closed Deferred': 11,
};

const STAGE_COLORS = {
  'Qualified':               { header: '#388bfd', bg: '#388bfd11' },
  'Discovery':               { header: '#3fb950', bg: '#3fb95011' },
  'Solution Shaping':        { header: '#d4a843', bg: '#d4a84311' },
  'Proposal in Development': { header: '#e36209', bg: '#e3620911' },
  'Proposal Delivered':      { header: '#f78166', bg: '#f7816611' },
  'Verbal Alignment':        { header: '#a371f7', bg: '#a371f711' },
  'Closed Won':              { header: '#3fb950', bg: '#3fb95011' },
  'Closed Lost':             { header: '#f85149', bg: '#f8514911' },
  'Closed Deferred':         { header: '#8b949e', bg: '#8b949e11' },
  'On Hold':                 { header: '#d4a843', bg: '#d4a84311' },
  'Active':                  { header: '#388bfd', bg: '#388bfd11' },
  'Complete':                { header: '#8b949e', bg: '#8b949e11' },
};

const CHIP_COLORS = {
  'Qualified':               { bg: '#388bfd22', text: '#388bfd' },
  'Discovery':               { bg: '#3fb95022', text: '#3fb950' },
  'Solution Shaping':        { bg: '#d4a84322', text: '#d4a843' },
  'Proposal in Development': { bg: '#e3620922', text: '#e36209' },
  'Proposal Delivered':      { bg: '#f7816622', text: '#f78166' },
  'Verbal Alignment':        { bg: '#a371f722', text: '#a371f7' },
  'Closed Won':              { bg: '#3fb95022', text: '#3fb950' },
  'Closed Lost':             { bg: '#f8514922', text: '#f85149' },
  'Closed Deferred':         { bg: '#8b949e22', text: '#8b949e' },
  'On Hold':                 { bg: '#d4a84322', text: '#d4a843' },
  'Active':                  { bg: '#388bfd22', text: '#388bfd' },
  'Complete':                { bg: '#8b949e22', text: '#8b949e' },
};

function fmt(val) {
  if (!val && val !== 0) return '—';
  return '$' + Math.round(val).toLocaleString();
}

export default function PipelinePage() {
  const qc = useQueryClient();
  const [view, setView] = useState('board');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const dragItem = useRef(null);

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => api.get('/opportunities').then(r => r.data),
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }) => api.put(`/opportunities/${id}`, { ...opportunities.find(o => o.id === id), stage }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/opportunities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });

  function byStage(stage) {
    return opportunities.filter(o => o.stage === stage);
  }

  function stageTotal(stage) {
    return byStage(stage).reduce((s, o) => s + (o.estimated_value || 0), 0);
  }

  function handleDragStart(e, opp) {
    dragItem.current = opp;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(e, stage) {
    e.preventDefault();
    if (dragItem.current && dragItem.current.stage !== stage) {
      stageMutation.mutate({ id: dragItem.current.id, stage });
    }
    setDragOver(null);
    dragItem.current = null;
  }

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(opp) { setEditing(opp); setModalOpen(true); }
  function handleClose() { setModalOpen(false); setEditing(null); }

  const totalPipeline = ACTIVE_STAGES.reduce((s, st) => s + stageTotal(st), 0);
  const totalWeighted = opportunities
    .filter(o => ACTIVE_STAGES.includes(o.stage))
    .reduce((s, o) => s + ((o.estimated_value || 0) * (o.confidence || 0) / 100), 0);

  // List view: all opps sorted by stage progression
  const sortedOpps = [...opportunities].sort((a, b) => {
    const sa = STAGE_SORT[a.stage] ?? 99;
    const sb = STAGE_SORT[b.stage] ?? 99;
    if (sa !== sb) return sa - sb;
    return (b.estimated_value || 0) - (a.estimated_value || 0);
  });

  return (
    <div className="pipeline-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pipeline</h1>
          <div className="pipeline-summary">
            <span>{ACTIVE_STAGES.reduce((s, st) => s + byStage(st).length, 0)} open opportunities</span>
            <span className="dot">·</span>
            <span>{fmt(totalPipeline)} total</span>
            <span className="dot">·</span>
            <span style={{ color: 'var(--gold)' }}>{fmt(totalWeighted)} weighted</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="view-toggle">
            <button
              className={view === 'board' ? 'view-btn active' : 'view-btn'}
              onClick={() => setView('board')}
            >Board</button>
            <button
              className={view === 'list' ? 'view-btn active' : 'view-btn'}
              onClick={() => setView('list')}
            >List</button>
          </div>
          <button className="btn-primary" onClick={openAdd}>+ Add Opportunity</button>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : view === 'board' ? (
        /* ── Board View ── */
        <div className="kanban-board kanban-board-wide">
          {ALL_BOARD_STAGES.map(stage => {
            const cards = byStage(stage);
            const color = STAGE_COLORS[stage];
            const isOver = dragOver === stage;
            return (
              <div
                key={stage}
                className={`kanban-col${isOver ? ' drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, stage)}
              >
                <div className="kanban-col-header" style={{ borderTopColor: color.header }}>
                  <span className="kanban-col-title">{stage}</span>
                  <div className="kanban-col-meta">
                    <span className="kanban-count">{cards.length}</span>
                    <span className="kanban-total">{fmt(stageTotal(stage))}</span>
                  </div>
                </div>
                <div className="kanban-cards">
                  {cards.map(opp => (
                    <div
                      key={opp.id}
                      className="kanban-card"
                      draggable
                      onDragStart={e => handleDragStart(e, opp)}
                      onClick={() => openEdit(opp)}
                      style={{ background: color.bg }}
                    >
                      <div className="card-name">{opp.name}</div>
                      <div className="card-account">{opp.account_name || '—'}</div>
                      <div className="card-meta">
                        <span className="card-value">{fmt(opp.estimated_value)}</span>
                        {opp.confidence != null && (
                          <span className="card-confidence">{opp.confidence}%</span>
                        )}
                      </div>
                      <div className="card-dates">
                        {opp.start_date && <span>Start: {opp.start_date}</span>}
                        {opp.close_date && <span>Close: {opp.close_date}</span>}
                      </div>
                      {(opp.duration_weeks || opp.fte_per_month) && (
                        <div className="card-resource">
                          {opp.duration_weeks && <span>{opp.duration_weeks}w</span>}
                          {opp.fte_per_month && <span>{opp.fte_per_month} FTE/mo</span>}
                        </div>
                      )}
                      {opp.owner_name && (
                        <div className="card-owner">{opp.owner_name}</div>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="kanban-empty">Drop here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List View ── */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {sortedOpps.length === 0 ? (
            <p style={{ padding: 20, color: 'var(--text-muted)' }}>No opportunities yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Account</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th>Confidence</th>
                  <th>Close Date</th>
                  <th>Director</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedOpps.map(opp => {
                  const chip = CHIP_COLORS[opp.stage] || { bg: '#8b949e22', text: '#8b949e' };
                  return (
                    <tr key={opp.id}>
                      <td style={{ fontWeight: 500 }}>{opp.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{opp.account_name || '—'}</td>
                      <td>
                        <span className="stage-chip" style={{ background: chip.bg, color: chip.text }}>
                          {opp.stage}
                        </span>
                      </td>
                      <td>{fmt(opp.estimated_value)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {opp.confidence != null ? `${opp.confidence}%` : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opp.close_date || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{opp.owner_name || '—'}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => openEdit(opp)}>Edit</button>
                          <button className="btn-danger" style={{ padding: '4px 10px' }} onClick={() => {
                            if (window.confirm(`Delete "${opp.name}"?`)) deleteMutation.mutate(opp.id);
                          }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalOpen && (
        <OpportunityModal
          opportunity={editing}
          onClose={handleClose}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['opportunities'] }); handleClose(); }}
        />
      )}
    </div>
  );
}
