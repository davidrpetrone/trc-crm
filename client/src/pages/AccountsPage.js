import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import './ListPage.css';

const BLANK = { name: '', industry: '', tier: '', website: '', notes: '' };

export default function AccountsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [search, setSearch] = useState('');

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? api.put(`/accounts/${editing.id}`, data)
      : api.post('/accounts', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(a) { setEditing(a); setForm({ name: a.name, industry: a.industry || '', tier: a.tier || '', website: a.website || '', notes: a.notes || '' }); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function set(f, v) { setForm(x => ({ ...x, [f]: v })); }

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="list-page">
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <button className="btn-primary" onClick={openAdd}>+ Add Account</button>
      </div>

      <div className="filter-row">
        <input type="text" placeholder="Search accounts..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
        <span className="filter-count">{filtered.length} accounts</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {isLoading ? <p style={{ padding: 20, color: 'var(--text-muted)' }}>Loading...</p> : (
          <table>
            <thead>
              <tr><th>Name</th><th>Industry</th><th>Tier</th><th>Website</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{a.industry || '—'}</td>
                  <td style={{ color: a.tier === 'A' ? '#3fb950' : a.tier === 'B' ? '#d4a843' : '#8b949e', fontWeight: 700 }}>{a.tier || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{a.website || '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn-danger" style={{ padding: '4px 10px' }} onClick={() => { if (window.confirm(`Delete ${a.name}?`)) deleteMutation.mutate(a.id); }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No accounts yet.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editing ? 'Edit Account' : 'Add Account'}</h2>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="modal-body">
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Company Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Industry</label>
                  <input value={form.industry} onChange={e => set('industry', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tier</label>
                  <select value={form.tier} onChange={e => set('tier', e.target.value)}>
                    <option value="">— None —</option>
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Website</label>
                <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
