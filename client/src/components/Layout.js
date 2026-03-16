import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './Layout.css';

const NAV = [
  { to: '/', label: 'Dashboard', exact: true },
  { to: '/relationships', label: 'Relationships' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/director-pack', label: 'Director Pack', roles: ['admin', 'director'] },
  { to: '/forecasting', label: 'Forecasting', roles: ['admin', 'finance'] },
  { to: '/accounts', label: 'Accounts' },
  { to: '/contacts', label: 'Contacts' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-trc">TRC</span>
          <span className="logo-crm">CRM</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.filter(n => !n.roles || n.roles.includes(user?.role)).map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exact}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
          <button className="btn-secondary" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
