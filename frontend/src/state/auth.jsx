import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, config: null, error: null });

  const load = useCallback(async (signal) => {
    try {
      const [config, user] = await Promise.all([
        api.config(signal),
        api.me(signal).catch((e) => {
          if (e.status === 401) return null; // simply signed out
          throw e;
        }),
      ]);
      setState({ status: 'ready', user, config, error: null });
    } catch (e) {
      if (e.name !== 'AbortError') setState({ status: 'error', user: null, config: null, error: e });
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  const value = useMemo(() => ({
    ...state,
    retry: () => { setState((s) => ({ ...s, status: 'loading' })); load(); },
    signOut: async () => {
      await api.logout().catch(() => {});
      setState((s) => ({ ...s, user: null }));
    },
    startDemo: async () => {
      await api.demoLogin();
      await load();
    },
  }), [state, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
