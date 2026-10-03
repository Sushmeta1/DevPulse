import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './services/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    const ctrl = new AbortController();
    api.me(ctrl.signal).then(setUser, (e) => e.name !== 'AbortError' && setUser(null));
    return () => ctrl.abort();
  }, []);

  if (user === undefined) {
    return <div className="grid min-h-screen place-items-center text-slate-500">Loading DevPulse...</div>;
  }

  const signOut = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signOut }}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
