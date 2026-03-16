import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isAfter, subMonths, parseISO } from 'date-fns';
import api from '../api';
import './ListPage.css';
import './ContactsPage.css';

const BLANK = {
  type: 'Contact',
  first_name: '', mi: '', last_name: '', title: '',
  account_id: '', trc_owner_id: '',
  email: '', linkedin: '',
  business_phone: '', mobile_phone: '',
  address: '', city: '', state: '', zip_code: '', country: '',
  executive_assistant: '', ea_email: '',
  overlap_flag: false,
  last_contact: '',
  notes: '',
};

function needsFollowUp(last_contact) {
  if (!last_contact) return true;
  try {
    return !isAfter(parseISO(last_contact), subMonths(new Date(), 3));
  } catch { return true; }
}

export default function ContactsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFollowUp, setFilterFollowUp] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
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

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? api.put(`/contacts/${editing.id}`, data)
      : api.post('/contacts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contacts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/contacts/${id}/active`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['relationships-active'] });
    },
  });

  function openAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }
  function openEdit(c) {
    setEditing(c);
    setForm({
      type: c.type || 'Contact',
      first_name: c.first_name || '', mi: c.mi || '', last_name: c.last_name || '',
      title: c.title || '', account_id: c.account_id || '', trc_owner_id: c.trc_owner_id || '',
      email: c.email || '', linkedin: c.linkedin || '',
      business_phone: c.business_phone || '', mobile_phone: c.mobile_phone || '',
      address: c.address || '', city: c.city || '', state: c.state || '',
      zip_code: c.zip_code || '', country: c.country || '',
      executive_assistant: c.executive_assistant || '', ea_email: c.ea_email || '',
      overlap_flag: !!c.overlap_flag,
      last_contact: c.last_contact || '',
      notes: c.notes || '',
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditing(null); }
  function set(f, v) { setForm(x => ({ ...x, [f]: v })); }

  const filtered = contacts.filter(c => {
    if (filterType && c.type !== filterType) return false;
    if (filterFollowUp && !needsFollowUp(c.last_contact)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.name?.toLowerCase().includes(q) &&
        !c.account_name?.toLowerCase().includes(q) &&
        !c.email?.toLowerCase().includes(q) &&
        !c.title?.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const followUpCount = contacts.filter(c => needsFollowUp(c.last_contact)).length;

  return (
    <div className="list-page">
      <div className="page-header">
        <h1 className="page-title">All Relationships</h1>
        <button className="btn-primary" onClick={openAdd}>+ Add Contact</button>
      </div>

      <div className="filter-row">
        <input
          type="text"
          placeholder="Search name, account, email, title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 130 }}>
          <option value="">All Types</option>
          <option value="Prospect">Prospect</option>
          <option value="Contact">Contact</option>
        </select>
        <button
          className={filterFollowUp ? 'btn-primary' : 'btn-secondary'}
          style={{ fontSize: 12 }}
          onClick={() => setFilterFollowUp(f => !f)}
        >
          Follow-up needed ({followUpCount})
        </button>
        {(search || filterType || filterFollowUp) && (
          <button className="btn-secondary" onClick={() => { setSearch(''); setFilterType(''); setFilterFollowUp(false); }}>
            Clear
          </button>
        )}
        <span className="filter-count">{filtered.length} of {contacts.length}</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 20, color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Active</th>
                <th>Type</th>
                <th>Name</th>
                <th>Title</th>
                <th>Account</th>
                <th>Email</th>
                <th>Business Phone</th>
                <th>TRC Owner</th>
                <th>Last Contact</th>
                <th>Follow-up?</th>
                <th>Overlap</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No contacts found.</td></tr>
              ) : filtered.map(c => {
                const fu = needsFollowUp(c.last_contact);
                const isActive = c.is_active !== false;
                return (
                  <tr key={c.id} style={{ opacity: isActive ? 1 : 0.5 }}>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        title={isActive ? 'Mark inactive' : 'Mark active'}
                        onClick={() => toggleActiveMutation.mutate({ id: c.id, is_active: !isActive })}
                        style={{
                          background: isActive ? '#3fb95022' : '#30363d',
                          border: `1px solid ${isActive ? '#3fb950' : '#484f58'}`,
                          borderRadius: 20, padding: '2px 10px', cursor: 'pointer',
                          color: isActive ? '#3fb950' : '#8b949e', fontSize: 11, fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <span className={`type-badge ${c.type === 'Prospect' ? 'prospect' : 'contact'}`}>
                        {c.type || 'Contact'}
                      </span>
                    </td>
                    <td>
                      <div className="contact-cell">
                        <span className="contact-name">{c.name || '—'}</span>
                        {c.executive_assistant && (
                          <span className="contact-ea">EA: {c.executive_assistant}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{c.title || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.account_name || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.email || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.business_phone || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.trc_owner_name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.last_contact || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {fu && <span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: 12 }}>Yes</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {c.overlap_flag ? <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 12 }}>Yes</span> : ''}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-secondary" style={{ padding: '4px 10px' }} onClick={() => openEdit(c)}>Edit</button>
                        <button className="btn-danger" style={{ padding: '4px 10px' }} onClick={() => {
                          if (window.confirm(`Delete ${c.name}?`)) deleteMutation.mutate(c.id);
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

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Contact' : 'Add Contact'}</h2>
              <button className="modal-close" onClick={closeForm}>✕</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                saveMutation.mutate({
                  ...form,
                  account_id: form.account_id || null,
                  trc_owner_id: form.trc_owner_id || null,
                  overlap_flag: form.overlap_flag ? 1 : 0,
                });
              }}
              className="modal-body"
            >
              {/* Type */}
              <div className="form-section-title">Identity</div>
              <div className="form-row three-col">
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)}>
                    <option value="Prospect">Prospect</option>
                    <option value="Contact">Contact</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Account</label>
                  <select value={form.account_id} onChange={e => set('account_id', e.target.value)}>
                    <option value="">— No account —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>TRC Owner</label>
                  <select value={form.trc_owner_id} onChange={e => set('trc_owner_id', e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row three-col">
                <div className="form-group">
                  <label>First Name</label>
                  <input value={form.first_name} onChange={e => set('first_name', e.target.value)} />
                </div>
                <div className="form-group" style={{ maxWidth: 80 }}>
                  <label>MI</label>
                  <input value={form.mi} onChange={e => set('mi', e.target.value)} maxLength={1} />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input value={form.last_name} onChange={e => set('last_name', e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Title</label>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="CEO, VP of Strategy..." />
              </div>

              {/* Contact info */}
              <div className="form-section-title">Contact Info</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>LinkedIn</label>
                  <input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Business Phone</label>
                  <input value={form.business_phone} onChange={e => set('business_phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Mobile Phone</label>
                  <input value={form.mobile_phone} onChange={e => set('mobile_phone', e.target.value)} />
                </div>
              </div>

              {/* Address */}
              <div className="form-section-title">Address</div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Street Address</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div className="form-row three-col">
                <div className="form-group">
                  <label>City</label>
                  <input value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input value={form.state} onChange={e => set('state', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Zip Code</label>
                  <input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Country</label>
                <input value={form.country} onChange={e => set('country', e.target.value)} placeholder="USA" />
              </div>

              {/* EA */}
              <div className="form-section-title">Executive Assistant</div>
              <div className="form-row">
                <div className="form-group">
                  <label>EA Name</label>
                  <input value={form.executive_assistant} onChange={e => set('executive_assistant', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>EA Email</label>
                  <input type="email" value={form.ea_email} onChange={e => set('ea_email', e.target.value)} />
                </div>
              </div>

              {/* Tracking */}
              <div className="form-section-title">Tracking</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Last Contact</label>
                  <input type="date" value={form.last_contact} onChange={e => set('last_contact', e.target.value)} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={form.overlap_flag}
                      onChange={e => set('overlap_flag', e.target.checked)}
                      style={{ width: 'auto', marginRight: 8 }}
                    />
                    Overlap Flag
                  </label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>Notes / Action Update</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4} />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
