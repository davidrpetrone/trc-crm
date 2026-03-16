import { useEffect, useState } from 'react';
import api from '../api';

const ROLES = ['admin', 'director', 'finance', 'consultant'];

export default function UserProfilesPage() {
  const [users, setUsers]       = useState([]);
  const [saving, setSaving]     = useState(null); // id of user being saved
  const [showAdd, setShowAdd]   = useState(false);
  const [newUser, setNewUser]   = useState({ name: '', email: '', role: 'consultant', password: '' });
  const [error, setError]       = useState('');

  async function load() {
    const { data } = await api.get('/users');
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  async function handleRoleChange(user, role) {
    setSaving(user.id);
    await api.put(`/users/${user.id}`, { name: user.name, email: user.email, role });
    setSaving(null);
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this user?')) return;
    await api.delete(`/users/${id}`);
    load();
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError('Name, email and password are required.');
      return;
    }
    try {
      await api.post('/users', newUser);
      setShowAdd(false);
      setNewUser({ name: '', email: '', role: 'consultant', password: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user.');
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#e6edf3' }}>User Profiles</h1>
        <button className="btn-primary" onClick={() => setShowAdd(s => !s)}>
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{
          background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
          padding: '20px 24px', marginBottom: 24, display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: '12px 20px'
        }}>
          <label style={labelStyle}>
            Name
            <input style={inputStyle} value={newUser.name}
              onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} />
          </label>
          <label style={labelStyle}>
            Email
            <input style={inputStyle} type="email" value={newUser.email}
              onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
          </label>
          <label style={labelStyle}>
            Password
            <input style={inputStyle} type="password" value={newUser.password}
              onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
          </label>
          <label style={labelStyle}>
            Profile Type
            <select style={inputStyle} value={newUser.role}
              onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
              {ROLES.map(r => <option key={r} value={r}>{roleName(r)}</option>)}
            </select>
          </label>
          {error && <div style={{ gridColumn: '1/-1', color: '#f85149', fontSize: 13 }}>{error}</div>}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
            <button type="submit" className="btn-primary">Create User</button>
          </div>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363d' }}>
            {['Name', 'Email', 'Profile Type', ''].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12,
                color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #21262d' }}>
              <td style={cellStyle}>{u.name}</td>
              <td style={{ ...cellStyle, color: '#8b949e' }}>{u.email}</td>
              <td style={cellStyle}>
                <select
                  value={u.role}
                  disabled={saving === u.id}
                  onChange={e => handleRoleChange(u, e.target.value)}
                  style={{
                    background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
                    color: roleColor(u.role), padding: '4px 10px', fontSize: 13, cursor: 'pointer'
                  }}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{roleName(r)}</option>
                  ))}
                </select>
                {saving === u.id && <span style={{ marginLeft: 8, fontSize: 12, color: '#8b949e' }}>saving…</span>}
              </td>
              <td style={{ ...cellStyle, textAlign: 'right' }}>
                <button
                  onClick={() => handleDelete(u.id)}
                  style={{ background: 'none', border: 'none', color: '#8b949e',
                    cursor: 'pointer', fontSize: 13, padding: '2px 8px' }}
                  title="Remove user"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 32, background: '#161b22', border: '1px solid #30363d',
        borderRadius: 8, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', marginBottom: 10,
          textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile Type Permissions</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Profile', 'Dashboard', 'Relationships', 'Pipeline', 'Director Pack', 'Forecasting'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#8b949e', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { role: 'admin',      perms: [true, true, true, true, true] },
              { role: 'director',   perms: [true, true, true, true, false] },
              { role: 'finance',    perms: [true, true, true, false, true] },
              { role: 'consultant', perms: [true, true, true, false, false] },
            ].map(({ role, perms }) => (
              <tr key={role} style={{ borderTop: '1px solid #21262d' }}>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{ color: roleColor(role), fontWeight: 600 }}>{roleName(role)}</span>
                </td>
                {perms.map((ok, i) => (
                  <td key={i} style={{ padding: '6px 10px', color: ok ? '#3fb950' : '#484f58' }}>
                    {ok ? '✓' : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function roleName(r) {
  return { admin: 'Admin', director: 'Director', finance: 'Finance', consultant: 'Consultant' }[r] || r;
}

function roleColor(r) {
  return { admin: '#f85149', director: '#d29922', finance: '#58a6ff', consultant: '#3fb950' }[r] || '#e6edf3';
}

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#8b949e' };
const inputStyle = {
  background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
  color: '#e6edf3', padding: '7px 10px', fontSize: 14, marginTop: 2
};
const cellStyle = { padding: '12px', color: '#e6edf3', fontSize: 14 };
