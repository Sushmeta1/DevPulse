import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { useAuth } from './auth.jsx';

export const RANGES = [7, 14, 30, 90];
const LAST_REPO = 'devpulse.repo';

const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);

const storedRepo = () => { try { return localStorage.getItem(LAST_REPO) || ''; } catch { return ''; } };

/**
 * Owns what the dashboard is looking at (repository, range, contributor filter - all in the URL so
 * links are shareable and Back works) and loads the data for it.
 */
export function WorkspaceProvider({ children }) {
  const { signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const [repos, setRepos] = useState({ status: 'loading', list: [], error: null });
  const [bundle, setBundle] = useState({ status: 'idle', data: null, error: null });
  const [generating, setGenerating] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [reposNonce, setReposNonce] = useState(0);
  const forceRefresh = useRef(false);

  const rangeParam = Number(params.get('range'));
  const days = RANGES.includes(rangeParam) ? rangeParam : 30;
  const repoParam = params.get('repo');
  const whoParam = params.get('who');

  const update = useCallback((changes, { replace = false } = {}) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      return next;
    }, { replace });
  }, [setParams]);

  const handleFailure = useCallback((e) => {
    if (e.name === 'AbortError') return false;
    if (e.status === 401) { signOut(); return false; }
    return true;
  }, [signOut]);

  // Repository list
  useEffect(() => {
    const ctrl = new AbortController();
    setRepos((r) => ({ ...r, status: 'loading', error: null }));
    api.repositories(ctrl.signal)
      .then((list) => setRepos({ status: 'ready', list, error: null }))
      .catch((e) => { if (handleFailure(e)) setRepos({ status: 'error', list: [], error: e }); });
    return () => ctrl.abort();
  }, [handleFailure, reposNonce]);

  // Choose a default repository once the list is known.
  const repo = repoParam || (repos.status === 'ready' ? (repos.list.find((r) => r.fullName === storedRepo())?.fullName || repos.list[0]?.fullName || '') : '');
  useEffect(() => {
    if (!repoParam && repo) update({ repo }, { replace: true });
  }, [repoParam, repo, update]);
  useEffect(() => {
    if (repo) { try { localStorage.setItem(LAST_REPO, repo); } catch { /* storage unavailable */ } }
  }, [repo]);

  // Everything the dashboard shows for (repo, range), fetched together.
  useEffect(() => {
    if (!repo) return undefined;
    const ctrl = new AbortController();
    const refresh = forceRefresh.current;
    forceRefresh.current = false;
    setBundle((b) => ({ ...b, status: b.data?.repo === repo ? 'refreshing' : 'loading', error: null }));
    Promise.all([
      api.summary(repo, days, refresh, ctrl.signal),
      api.pulls(repo, days, ctrl.signal),
      api.commits(repo, days, ctrl.signal),
      api.reports(repo, ctrl.signal),
    ])
      .then(([summary, pulls, commits, reports]) => {
        setBundle({ status: 'ready', data: { repo, days, summary, pulls, commits, reports }, error: null });
        if (refresh) toast.success('Synced with GitHub');
      })
      .catch((e) => {
        if (handleFailure(e)) setBundle((b) => ({ status: 'error', data: b.data?.repo === repo ? b.data : null, error: e }));
      });
    return () => ctrl.abort();
  }, [repo, days, nonce, handleFailure]);

  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const report = await api.generateSummary(repo, days);
      setBundle((b) => (b.data?.repo === repo ? { ...b, data: { ...b.data, reports: [report, ...b.data.reports] } } : b));
      toast.success('Sprint summary generated');
      return report;
    } catch (e) {
      if (handleFailure(e)) toast.error(e.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [repo, days, handleFailure]);

  const data = bundle.data && bundle.data.repo === repo ? bundle.data : null;
  const who = data && whoParam && data.summary.topContributors.some((p) => p.login === whoParam) ? whoParam : null;

  const value = useMemo(() => ({
    repos, repo, days, who, data,
    repoMeta: repos.list.find((r) => r.fullName === repo) || null,
    status: data ? (bundle.status === 'refreshing' ? 'refreshing' : bundle.status === 'error' ? 'error' : 'ready') : bundle.status === 'error' ? 'error' : 'loading',
    error: bundle.error,
    generating,
    setRepo: (r) => update({ repo: r, who: null }),
    setDays: (d) => update({ range: d }),
    setWho: (w) => update({ who: w }),
    refresh: () => { forceRefresh.current = true; setNonce((n) => n + 1); },
    retry: () => { setNonce((n) => n + 1); setReposNonce((n) => n + 1); },
    generate,
  }), [repos, repo, days, who, data, bundle.status, bundle.error, generating, update, generate]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
