import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { useAsync } from '../lib/useAsync.js';
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
  const [generating, setGenerating] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [listNonce, setListNonce] = useState(0);
  const [reportsNonce, setReportsNonce] = useState(0);
  const forceRefresh = useRef(false);
  const forceList = useRef(false);

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

  // Repository list (cached server-side; "Refresh" on the Repositories page forces a GitHub round trip).
  const list = useAsync((signal) => {
    const refresh = forceList.current;
    forceList.current = false;
    return api.repositories(refresh, signal);
  }, `repos|${listNonce}`);

  const repos = {
    status: list.error && list.value === undefined ? 'error' : list.value === undefined ? 'loading' : 'ready',
    list: list.value ?? [],
    error: list.error,
  };

  // Choose a default repository once the list is known.
  const fallback = repos.status === 'ready'
    ? (repos.list.find((r) => r.fullName === storedRepo())?.fullName || repos.list[0]?.fullName || '')
    : '';
  const repo = repoParam || fallback;
  useEffect(() => {
    if (!repoParam && repo) update({ repo }, { replace: true });
  }, [repoParam, repo, update]);
  useEffect(() => {
    if (repo) { try { localStorage.setItem(LAST_REPO, repo); } catch { /* storage unavailable */ } }
  }, [repo]);

  // Everything the dashboard shows for (repo, range), fetched together.
  const bundle = useAsync(async (signal) => {
    const refresh = forceRefresh.current;
    forceRefresh.current = false;
    const [summary, pulls, commits] = await Promise.all([
      api.summary(repo, days, refresh, signal),
      api.pulls(repo, days, signal),
      api.commits(repo, days, signal),
    ]);
    if (refresh) toast.success('Synced with GitHub');
    return { repo, days, summary, pulls, commits };
  }, repo ? `${repo}|${days}|${nonce}` : null);

  const reportsRes = useAsync((signal) => api.reports(repo, signal).then((reports) => ({ repo, reports })), repo ? `${repo}|${reportsNonce}` : null);

  // An expired GitHub token or session sends people back to sign in - and tells them why.
  const unauthorized = [list.error, bundle.error, reportsRes.error].some((e) => e?.status === 401);
  const signedOut = useRef(false);
  useEffect(() => {
    if (unauthorized && !signedOut.current) {
      signedOut.current = true;
      toast.error('Your session expired. Please sign in again.');
      signOut();
    }
  }, [unauthorized, signOut]);

  const data = bundle.value && bundle.value.repo === repo
    ? { ...bundle.value, reports: reportsRes.value?.repo === repo ? reportsRes.value.reports : [] }
    : null;
  const who = data && whoParam && data.summary.topContributors.some((p) => p.login === whoParam) ? whoParam : null;

  let status = 'loading';
  if (bundle.error && !unauthorized) status = 'error';
  else if (bundle.settled) status = 'ready';
  else if (data) status = 'refreshing';

  const generate = async () => {
    setGenerating(true);
    try {
      const report = await api.generateSummary(repo, days);
      setReportsNonce((n) => n + 1);
      toast.success('Sprint summary generated');
      return report;
    } catch (e) {
      if (e.status !== 401) toast.error(e.message);
      return null;
    } finally {
      setGenerating(false);
    }
  };

  // Consumers re-render with the provider anyway, so memoising this object would buy nothing.
  const value = {
    repos, repo, days, who, data, status,
    repoMeta: repos.list.find((r) => r.fullName === repo) || null,
    error: unauthorized ? null : bundle.error,
    generating,
    setRepo: (r) => update({ repo: r, who: null }),
    setDays: (d) => update({ range: d }),
    setWho: (w) => update({ who: w }),
    refresh: () => { forceRefresh.current = true; setNonce((n) => n + 1); },
    refreshRepos: () => { forceList.current = true; setListNonce((n) => n + 1); },
    retry: () => { setNonce((n) => n + 1); setListNonce((n) => n + 1); },
    generate,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
