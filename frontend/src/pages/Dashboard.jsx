import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../App.jsx';
import Header from '../components/Header.jsx';
import { StatCard } from '../components/Card.jsx';
import CommitChart from '../components/CommitChart.jsx';
import PullRequestChart from '../components/PullRequestChart.jsx';
import Contributors from '../components/Contributors.jsx';
import PullRequestList from '../components/PullRequestList.jsx';
import AiSummary from '../components/AiSummary.jsx';
import { formatHours } from '../lib/format.js';

const RANGES = [7, 14, 30, 90];
const STORAGE_KEY = 'devpulse.repo';
const stored = () => { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; } };

export default function Dashboard() {
  const { signOut } = useAuth();
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState(stored);
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [pulls, setPulls] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [aiError, setAiError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // An expired GitHub token / session sends the user back to the login screen.
  const handleError = useCallback((e, set) => {
    if (e.name === 'AbortError') return;
    if (e.status === 401) signOut();
    else set(e.message);
  }, [signOut]);

  useEffect(() => {
    const ctrl = new AbortController();
    api.repositories(ctrl.signal)
      .then((list) => {
        setRepos(list);
        setRepo((current) => (current && list.some((r) => r.fullName === current) ? current : list[0]?.fullName || ''));
      })
      .catch((e) => handleError(e, setError));
    return () => ctrl.abort();
  }, [handleError]);

  useEffect(() => {
    if (!repo) return undefined;
    try { localStorage.setItem(STORAGE_KEY, repo); } catch { /* storage unavailable */ }
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    setAiError('');
    const refresh = reloadKey > 0;
    Promise.all([api.summary(repo, days, refresh, ctrl.signal), api.pulls(repo, days, ctrl.signal), api.reports(repo, ctrl.signal)])
      .then(([s, p, r]) => {
        setSummary(s);
        setPulls(p);
        setReport(r[0] || null);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setLoading(false);
        setSummary(null);
        handleError(e, setError);
      });
    return () => ctrl.abort();
  }, [repo, days, reloadKey, handleError]);

  const generate = async () => {
    setGenerating(true);
    setAiError('');
    try {
      setReport(await api.generateSummary(repo, days));
    } catch (e) {
      handleError(e, setAiError);
    } finally {
      setGenerating(false);
    }
  };

  const t = summary?.totals;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Repository overview</h1>
            {summary && <p className="text-sm text-slate-500">{summary.repository.description || summary.repository.fullName}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Repository"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              className="max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {repos.map((r) => <option key={r.id} value={r.fullName}>{r.fullName}</option>)}
            </select>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm" role="group" aria-label="Time range">
              {RANGES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={`px-3 py-2 ${days === d ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button onClick={() => setReloadKey((k) => k + 1)} disabled={!repo || loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50">
              Refresh
            </button>
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!repo && !error && <p className="py-16 text-center text-slate-500">No repositories found on your GitHub account.</p>}

        {repo && (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
            {summary && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <StatCard label="Commits" value={t.commits} hint={`last ${days} days`} />
                  <StatCard label="Pull requests" value={t.pullRequests} hint={`${t.mergedPullRequests} merged / ${t.openPullRequests} open`} />
                  <StatCard label="Contributors" value={t.contributors} />
                  <StatCard label="Avg. time to merge" value={formatHours(t.avgMergeHours)} />
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                  <CommitChart data={summary.commitsByDay} total={t.commits} />
                  <PullRequestChart data={summary.pullRequestsByState} />
                  <PullRequestList pulls={pulls} />
                  <Contributors people={summary.topContributors} />
                  <div className="lg:col-span-3">
                    <AiSummary report={report} generating={generating} error={aiError} onGenerate={generate} />
                  </div>
                </div>
              </div>
            )}
            {!summary && loading && <p className="py-16 text-center text-slate-500">Fetching GitHub activity...</p>}
          </div>
        )}
      </main>
    </div>
  );
}
