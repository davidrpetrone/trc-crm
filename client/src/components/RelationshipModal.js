import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api';
import './Modal.css';

const STAGES = [
  'Target Identified',
  'Relationship Active',
  'Relationship Developing',
  'Commercial Signal Observed',
  'Convert to Opportunity',
];

const SALES_MOTIONS = ['Relationship-led', 'Referral/PE-led', 'Market-driven'];

const BLANK = {
  contact_id: '',
  account_id: '',
  owner_id: '',
  stage: 'Target Identified',
  tier: '',
  last_touch: '',
  next_action_date: '',
  next_action_notes: '',
  ea_linked: '',
  sales_motion: '',
  notes: '',
  is_active: true,
};

export default function RelationshipModal({ relationship, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api.get('/contacts').then(r => r.data),
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get('/accounts').then(r => r.data),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  useEffect(() => {
    if (relationship) {
      setForm({
        contact_id: relationship.contact_id || '',
        account_id: relationship.account_id || '',
        owner_id: relationship.owner_id || '',
        stage: relationship.stage || 'Target Identified',
        tier: relationship.tier || '',
        last_touch: relationship.last_touch || '',
        next_action_date: relationship.next_action_date || '',
        next_action_notes: relationship.next_action_notes || '',
        ea_linked: relationship.ea_linked || '',
        sales_motion: relationship.sales_motion || '',
        notes: relationship.notes || '',
        is_active: relationship.is_active !== false,
      });
    } else {
      setForm(BLANK);
    }
  }, [relationship]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // Auto-fill account when contact is selected
  function handleContactChange(contactId) {
    set('contact_id', contactId);
    if (contactId) {
      const c = contacts.find(c => String(c.id) === String(contactId));
      if (c?.account_id && !form.account_id) {
        set('account_id', c.account_id);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        contact_id: form.contact_id || null,
        account_id: form.account_id || null,
        owner_id: form.owner_id || null,
      };
      if (relationship?.id) {
        await api.put(`/relationships/${relationship.id}`, payload);
      } else {
        await api.post('/relationships', payload);
      }
      // Sync active status on the contact
      if (form.contact_id) {
        await api.patch(`/contacts/${form.contact_id}/active`, { is_active: form.is_active !== false });
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
      <div className="modal">
        <div className="modal-header">
          <h2>{relationship?.id ? 'Edit Relationship' : 'Add Relationship'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Contact</label>
              <select value={form.contact_id} onChange={e => handleContactChange(e.target.value)}>
                <option value="">— Select contact —</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.account_name ? ` (${c.account_name})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Account</label>
              <select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
                <option value="">— Select account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
              <label>Tier</label>
              <select value={form.tier} onChange={e => set('tier', e.target.value)}>
                <option value="">— None —</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Owner</label>
              <select value={form.owner_id} onChange={e => set('owner_id', e.target.value)}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sales Motion</label>
              <select value={form.sales_motion} onChange={e => set('sales_motion', e.target.value)}>
                <option value="">— None —</option>
                {SALES_MOTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Last Touch</label>
              <input type="date" value={form.last_touch} onChange={e => set('last_touch', e.target.value)} />
            </div>
            <div className="form-group">
              <label>EA Linked</label>
              <input type="text" value={form.ea_linked} onChange={e => set('ea_linked', e.target.value)} placeholder="Executive advisor name" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Next Action Date</label>
              <input type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Next Action Notes</label>
              <input type="text" value={form.next_action_notes} onChange={e => set('next_action_notes', e.target.value)} placeholder="What to do..." />
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Background, context, relationship history..." />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label style={{ marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                style={{ width: 'auto', marginRight: 8 }}
              />
              Active Contact
            </label>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : relationship?.id ? 'Save Changes' : 'Add Relationship'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
