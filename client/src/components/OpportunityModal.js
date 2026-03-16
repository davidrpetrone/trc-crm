import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import './Modal.css';

const STAGES = [
  'Qualified',
  'Discovery',
  'Solution Shaping',
  'Proposal in Development',
  'Proposal Delivered',
  'Verbal Alignment',
  'Closed Won',
  'Closed Lost',
  'Closed Deferred',
];

const SALES_MOTIONS = ['Relationship-led', 'Referral/PE-led', 'Market-driven'];

const SERVICE_LINES = [
  'Strategy',
  'Operations',
  'Technology',
  'Finance & Accounting',
  'Human Capital',
  'Private Equity',
  'Other',
];

const BLANK = {
  name: '',
  account_id: '',
  contact_id: '',
  owner_id: '',
  stage: 'Qualified',
  sales_motion: '',
  estimated_value: '',
  confidence: '',
  service_line: '',
  close_date: '',
  start_date: '',
  duration_weeks: '',
  fte_per_month: '',
  notes: '',
};

export default function OpportunityModal({ opportunity, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.get('/contacts').then(r => r.data),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  useEffect(() => {
    if (opportunity) {
      setForm({
        name: opportunity.name || '',
        account_id: opportunity.account_id || '',
        contact_id: opportunity.contact_id || '',
        owner_id: opportunity.owner_id || '',
        stage: opportunity.stage || 'Qualified',
        sales_motion: opportunity.sales_motion || '',
        estimated_value: opportunity.estimated_value ?? '',
        confidence: opportunity.confidence ?? '',
        service_line: opportunity.service_line || '',
        close_date: opportunity.close_date || '',
        start_date: opportunity.start_date || '',
        duration_weeks: opportunity.duration_weeks ?? '',
        fte_per_month: opportunity.fte_per_month ?? '',
        notes: opportunity.notes || '',
      });
    } else {
      setForm(BLANK);
    }
  }, [opportunity]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  // Filter contacts by selected account
  const filteredContacts = form.account_id
    ? contacts.filter(c => String(c.account_id) === String(form.account_id))
    : contacts;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        account_id: form.account_id || null,
        contact_id: form.contact_id || null,
        owner_id: form.owner_id || null,
        estimated_value: form.estimated_value !== '' ? Number(form.estimated_value) : null,
        confidence: form.confidence !== '' ? Number(form.confidence) : null,
        duration_weeks: form.duration_weeks !== '' ? Number(form.duration_weeks) : null,
        fte_per_month: form.fte_per_month !== '' ? Number(form.fte_per_month) : null,
      };
      if (opportunity) {
        await api.put(`/opportunities/${opportunity.id}`, payload);
      } else {
        await api.post('/opportunities', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <h2>{opportunity ? 'Edit Opportunity' : 'Add Opportunity'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Opportunity Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Acme Corp — Operations Assessment" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Account</label>
              <select value={form.account_id} onChange={e => { set('account_id', e.target.value); set('contact_id', ''); }}>
                <option value="">— Select account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Primary Contact</label>
              <select value={form.contact_id} onChange={e => set('contact_id', e.target.value)}>
                <option value="">— Select contact —</option>
                {filteredContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Stage</label>
              <select value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Owner</label>
              <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Sales Motion</label>
              <select value={form.sales_motion} onChange={e => set('sales_motion', e.target.value)}>
                <option value="">— None —</option>
                {SALES_MOTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Service Line</label>
              <select value={form.service_line} onChange={e => set('service_line', e.target.value)}>
                <option value="">— None —</option>
                {SERVICE_LINES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Estimated Value ($)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.estimated_value}
                onChange={e => set('estimated_value', e.target.value)}
                placeholder="e.g. 250000"
              />
            </div>
            <div className="form-group">
              <label>Confidence (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.confidence}
                onChange={e => set('confidence', e.target.value)}
                placeholder="0–100"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Target Close Date</label>
              <input type="date" value={form.close_date} onChange={e => set('close_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Engagement Start Date</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Duration (weeks)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.duration_weeks}
                onChange={e => set('duration_weeks', e.target.value)}
                placeholder="e.g. 12"
              />
            </div>
            <div className="form-group">
              <label>Est. FTE / Month</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.fte_per_month}
                onChange={e => set('fte_per_month', e.target.value)}
                placeholder="e.g. 2.5"
              />
            </div>
          </div>

          {(form.duration_weeks && form.fte_per_month) && (
            <div className="fte-preview">
              {Number(form.duration_weeks)} wks · ~{Math.ceil(Number(form.duration_weeks) / 4.33)} months ·&nbsp;
              <strong>{Number(form.fte_per_month)} FTE/mo</strong> ·&nbsp;
              Total: <strong>{(Number(form.fte_per_month) * Math.ceil(Number(form.duration_weeks) / 4.33)).toFixed(1)} FTE-months</strong>
              {form.confidence && (
                <span style={{ color: 'var(--text-muted)' }}>
                  &nbsp;· Weighted: {(Number(form.fte_per_month) * Math.ceil(Number(form.duration_weeks) / 4.33) * Number(form.confidence) / 100).toFixed(1)} FTE-mo @ {form.confidence}%
                </span>
              )}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Context, next steps, blockers..." />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : opportunity ? 'Save Changes' : 'Add Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
