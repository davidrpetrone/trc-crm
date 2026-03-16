import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './Layout.css';

const NAV_SECTIONS = [
  {
    items: [
      { to: '/', label: 'Dashboard', exact: true },
    ],
  },
  {
    heading: 'Relationships',
    items: [
      { to: '/relationships', label: 'Active Relationships' },
      { to: '/contacts', label: 'All Relationships' },
    ],
  },
  {
    heading: 'Opportunities',
    items: [
      { to: '/committed', label: 'Committed Engagements' },
      { to: '/pipeline', label: 'Pipeline' },
    ],
  },
  {
    heading: 'Forecasting',
    items: [
      { to: '/forecasting', label: 'Revenue Outlook', roles: ['admin', 'finance'] },
      { to: '/resourcing', label: 'Resourcing Outlook', roles: ['admin', 'finance'] },
    ],
  },
  {
    heading: 'Other Views',
    items: [
      { to: '/director-pack', label: 'Director Pack', roles: ['admin', 'director'] },
    ],
  },
  {
    heading: 'Admin',
    roles: ['admin'],
    items: [
      { to: '/user-profiles', label: 'User Profiles' },
      { to: '/financial-inputs', label: 'Financial Inputs' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleSections = NAV_SECTIONS
    .filter(s => !s.roles || s.roles.includes(user?.role))
    .map(s => ({ ...s, items: s.items.filter(n => !n.roles || n.roles.includes(user?.role)) }))
    .filter(s => s.items.length > 0);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-trc">TRC</span>
          <span className="logo-crm">CRM</span>
        </div>
        <nav className="sidebar-nav">
          {visibleSections.map((section, i) => (
            <div key={i} className="nav-section">
              {section.heading && (
                <div className="nav-section-heading">{section.heading}</div>
              )}
              {section.items.map(n => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.exact}
                  className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
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
