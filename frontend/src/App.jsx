import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './state/auth.jsx';
import { WorkspaceProvider } from './state/workspace.jsx';
import { ErrorState } from './components/ui/States.jsx';
import { Spinner } from './components/ui/Spinner.jsx';
import { useTheme } from './lib/theme.js';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';

// Charts and the command menu are only needed after sign-in, so they load as a separate chunk.
const Shell = lazy(() => import('./components/layout/Shell.jsx').then((m) => ({ default: m.Shell })));
const Repositories = lazy(() => import('./pages/Repositories.jsx'));
const Overview = lazy(() => import('./pages/Overview.jsx'));
const Pulls = lazy(() => import('./pages/Pulls.jsx'));
const People = lazy(() => import('./pages/People.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const Reviews = lazy(() => import('./pages/Reviews.jsx'));
const Team = lazy(() => import('./pages/Team.jsx'));
const Digest = lazy(() => import('./pages/Digest.jsx'));

function Splash() {
  return <div className="grid min-h-dvh place-items-center text-fg-faint" role="status" aria-label="Loading"><Spinner size={20} /></div>;
}

const Lazy = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;

function Routed() {
  const { status, user, error, retry } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'error') return <div className="grid min-h-dvh place-items-center"><ErrorState error={error} onRetry={retry} /></div>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route
        path="/dashboard"
        element={user ? <WorkspaceProvider><Suspense fallback={<Splash />}><Shell /></Suspense></WorkspaceProvider> : <Navigate to="/" replace />}
      >
        <Route index element={<Lazy><Overview /></Lazy>} />
        <Route path="repositories" element={<Lazy><Repositories /></Lazy>} />
        <Route path="team" element={<Lazy><Team /></Lazy>} />
        <Route path="digest" element={<Lazy><Digest /></Lazy>} />
        <Route path="reviews" element={<Lazy><Reviews /></Lazy>} />
        <Route path="pulls" element={<Lazy><Pulls /></Lazy>} />
        <Route path="people" element={<Lazy><People /></Lazy>} />
        <Route path="insights" element={<Lazy><Insights /></Lazy>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  const { resolved } = useTheme();
  return (
    <AuthProvider>
      <Routed />
      <Toaster
        theme={resolved} position="bottom-right" gap={8}
        style={{ '--normal-bg': 'var(--surface)', '--normal-text': 'var(--fg)', '--normal-border': 'var(--ring)', '--border-radius': '10px' }}
      />
    </AuthProvider>
  );
}
