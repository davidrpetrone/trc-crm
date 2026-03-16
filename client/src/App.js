import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RelationshipsPage from './pages/RelationshipsPage';
import PipelinePage from './pages/PipelinePage';
import DirectorPackPage from './pages/DirectorPackPage';
import ForecastingPage from './pages/ForecastingPage';
import AccountsPage from './pages/AccountsPage';
import ContactsPage from './pages/ContactsPage';
import UserProfilesPage from './pages/UserProfilesPage';
import CommittedEngagementsPage from './pages/CommittedEngagementsPage';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, color: '#8b949e' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="relationships" element={<RelationshipsPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="director-pack" element={<PrivateRoute roles={['admin', 'director']}><DirectorPackPage /></PrivateRoute>} />
        <Route path="forecasting" element={<PrivateRoute roles={['admin', 'finance']}><ForecastingPage /></PrivateRoute>} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="committed" element={<CommittedEngagementsPage />} />
        <Route path="user-profiles" element={<PrivateRoute roles={['admin']}><UserProfilesPage /></PrivateRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
