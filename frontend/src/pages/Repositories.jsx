import { useMemo, useState } from 'react';
import { FolderSearch, RefreshCw, Search } from 'lucide-react';
import { RepoCard } from '../components/dashboard/RepoCard.jsx';
import { Sparkline } from '../components/charts/Sparkline.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Number } from '../components/ui/Number.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { Switch } from '../components/ui/Switch.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { useWorkspace } from '../state/workspace.jsx';
import { useDocumentTitle, useFirstOnly } from '../lib/hooks.js';
import { plural } from '../lib/format.js';

const PAGE = 24;
const SORTS = {
  recent: (a, b) => new Date(b.pushedAt || 0) - new Date(a.pushedAt || 0),
  active: (a, b) => (b.commits30 ?? -1) - (a.commits30 ?? -1) || new Date(b.pushedAt || 0) - new Date(a.pushedAt || 0),
  stars: (a, b) => b.stars - a.stars,
  name: (a, b) => a.fullName.localeCompare(b.fullName),
};

function Stat({ label, children, hint }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-[13px] font-medium text-fg-muted">{label}</p>
      <div className="num mt-1.5 text-[28px] font-semibold leading-none tracking-tight">{children}</div>
      <p className="mt-1.5 truncate text-xs text-fg-muted">{hint}</p>
    </div>
  );
}

export default function Repositories() {
  useDocumentTitle('Repositories');
  const ws = useWorkspace();
  const first = useFirstOnly('repositories');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [analyzedOnly, setAnalyzedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const { status, list, error } = ws.repos;

  const synced = useMemo(() => list.filter((r) => r.synced), [list]);
  const totals = useMemo(() => {
    const activity = Array.from({ length: 30 }, () => 0);
    let open = 0;
    synced.forEach((r) => { r.activity.forEach((n, i) => { activity[i] += n; }); open += r.openPulls; });
    return { activity, commits: activity.reduce((a, b) => a + b, 0), open };
  }, [synced]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((r) => (!analyzedOnly || r.synced)
        && (!q || r.fullName.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || (r.language || '').toLowerCase().includes(q)))
      .sort(SORTS[sort]);
  }, [list, query, sort, analyzedOnly]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
          <p className="mt-1 text-[13px] text-fg-muted">Everything you can access on GitHub. Open one to analyze it; analyzed repositories show their last 30 days.</p>
        </div>
        <Button icon={RefreshCw} onClick={ws.refreshRepos} loading={status === 'loading'}>Refresh list</Button>
      </div>

      {status === 'error' && <div className="card"><ErrorState error={error} onRetry={ws.retry} /></div>}

      {status === 'loading' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading repositories">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card p-5"><Skeleton className="h-4 w-40" /><Skeleton className="mt-3 h-8 w-full" /><Skeleton className="mt-4 h-10 w-full" /></div>
          ))}
        </div>
      )}

      {status === 'ready' && list.length === 0 && (
        <EmptyState icon={FolderSearch} title="No repositories found" className="card py-16">Your GitHub account has no repositories DevPulse can read yet.</EmptyState>
      )}

      {status === 'ready' && list.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Repositories" hint={`${list.filter((r) => r.isPrivate).length} private`}><Number value={list.length} /></Stat>
            <Stat label="Analyzed" hint={synced.length ? 'Synced into DevPulse' : 'Open a repository to start'}><Number value={synced.length} /></Stat>
            <Stat label="Commits, 30 days" hint="Across analyzed repositories">
              <Number value={totals.commits} />
              <div className="mt-3 h-8 font-normal"><Sparkline values={totals.activity} height={32} color="var(--accent)" label="Commits per day across analyzed repositories" /></div>
            </Stat>
            <Stat label="Open pull requests" hint="Across analyzed repositories"><Number value={totals.open} /></Stat>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="relative">
              <span className="sr-only">Search repositories</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
              <input
                type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search name, description, language"
                className="h-8 w-72 max-w-full rounded-lg bg-surface pl-8 pr-2.5 text-[13px] shadow-[0_0_0_1px_var(--ring)] outline-none transition-shadow duration-150 placeholder:text-fg-faint focus:shadow-[0_0_0_2px_var(--accent)]"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Switch checked={analyzedOnly} onCheckedChange={(v) => { setAnalyzedOnly(v); setShown(PAGE); }} label="Analyzed only" />
              <Segmented
                label="Sort repositories" size="sm" value={sort} onChange={setSort}
                options={[{ value: 'recent', label: 'Recent' }, { value: 'active', label: 'Most active' }, { value: 'stars', label: 'Stars' }, { value: 'name', label: 'Name' }]}
              />
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState icon={FolderSearch} title="No matching repositories" className="card py-14">Try a different search, or turn off “Analyzed only”.</EmptyState>
          ) : (
            <>
              <p className="sr-only" role="status">{plural(rows.length, 'repository', 'repositories')}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.slice(0, shown).map((r, i) => <RepoCard key={r.id} repo={r} range={ws.days} index={i} animate={first} />)}
              </div>
              {rows.length > shown && (
                <div className="flex justify-center pt-2">
                  <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
