import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useAsync } from '../lib/useAsync.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [nonce, setNonce] = useState(0);
  // Set after a sign-in/out action so the UI reflects it immediately, without waiting for a reload.
  const [override, setOverride] = useState(undefined);

  const boot = useAsync(
    (signal) => Promise.all([
      api.config(signal),
      api.me(signal).catch((e) => {
        if (e.status === 401) return null; // simply signed out
        throw e;
      }),
    ]),
    `auth|${nonce}`,
  );

  const signOut = useCallback(async () => {
    await api.logout().catch(() => {});
    setOverride(null);
  }, []);

  const value = useMemo(() => {
    const loaded = boot.value !== undefined;
    return {
      status: boot.error && !loaded ? 'error' : loaded ? 'ready' : 'loading',
      error: boot.error,
      config: boot.value?.[0] ?? null,
      user: override !== undefined ? override : boot.value?.[1] ?? null,
      retry: () => setNonce((n) => n + 1),
      signOut,
      startDemo: async () => {
        await api.demoLogin();
        setOverride(await api.me());
      },
      deleteAccount: async () => {
        await api.deleteAccount();
        setOverride(null);
      },
    };
  }, [boot.value, boot.error, override, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
