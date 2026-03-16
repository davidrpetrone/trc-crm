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
};

function fmt(val) {
  if (!val && val !== 0) return '—';
  return '$' + Math.round(val).toLocaleString();
}

export default function PipelinePage() {
  const qc = useQueryClient();
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

  const closedWon = byStage('Closed Won');
  const closedLost = byStage('Closed Lost');
  const closedDeferred = byStage('Closed Deferred');

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
        <button className="btn-primary" onClick={openAdd}>+ Add Opportunity</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <>
          {/* Kanban board */}
          <div className="kanban-board">
            {ACTIVE_STAGES.map(stage => {
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

          {/* Closed deals */}
          {(closedWon.length + closedLost.length + closedDeferred.length) > 0 && (
            <div className="closed-section">
              <h2 className="section-title">Closed Deals</h2>
              <div className="closed-grid">
                {[
                  { label: 'Won', items: closedWon, color: '#3fb950' },
                  { label: 'Lost', items: closedLost, color: '#f85149' },
                  { label: 'Deferred', items: closedDeferred, color: '#8b949e' },
                ].map(({ label, items, color }) => (
                  items.length > 0 && (
                    <div key={label} className="card">
                      <div className="closed-header" style={{ color }}>
                        Closed {label} — {items.length} deal{items.length !== 1 ? 's' : ''} · {fmt(items.reduce((s, o) => s + (o.estimated_value || 0), 0))}
                      </div>
                      <table>
                        <thead>
                          <tr><th>Name</th><th>Account</th><th>Value</th><th>Owner</th><th></th></tr>
                        </thead>
                        <tbody>
                          {items.map(opp => (
                            <tr key={opp.id}>
                              <td style={{ fontWeight: 500 }}>{opp.name}</td>
                              <td style={{ color: 'var(--text-muted)' }}>{opp.account_name || '—'}</td>
                              <td>{fmt(opp.estimated_value)}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{opp.owner_name || '—'}</td>
                              <td>
                                <div className="row-actions">
                                  <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => openEdit(opp)}>Edit</button>
                                  <button className="btn-danger" style={{ padding: '4px 10px' }} onClick={() => {
                                    if (window.confirm(`Delete "${opp.name}"?`)) deleteMutation.mutate(opp.id);
                                  }}>Delete</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </>
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
