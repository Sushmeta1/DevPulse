import { useSyncExternalStore } from 'react';

const KEY = 'devpulse.theme';
const listeners = new Set();
const dark = () => window.matchMedia('(prefers-color-scheme: dark)');

function read() {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
}
const resolve = (pref) => (pref === 'system' ? (dark().matches ? 'dark' : 'light') : pref);
const apply = (pref) => { document.documentElement.dataset.theme = resolve(pref); };

export function setTheme(pref) {
  try { localStorage.setItem(KEY, pref); } catch { /* storage unavailable */ }
  apply(pref);
  listeners.forEach((l) => l());
}

function subscribe(cb) {
  listeners.add(cb);
  const mq = dark();
  const onSystem = () => { if (read() === 'system') { apply('system'); cb(); } };
  mq.addEventListener('change', onSystem);
  return () => { listeners.delete(cb); mq.removeEventListener('change', onSystem); };
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, read, () => 'system');
  const resolved = resolve(preference);
  return { preference, resolved, setTheme, toggle: () => setTheme(resolved === 'dark' ? 'light' : 'dark') };
}
