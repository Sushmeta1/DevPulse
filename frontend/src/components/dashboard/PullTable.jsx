import { useMemo, useState } from 'react';
import { ArrowUpDown, GitMerge, GitPullRequest, GitPullRequestClosed, Search } from 'lucide-react';
import { Card } from '../ui/Card.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { EmptyState } from '../ui/States.jsx';
import { formatHours, plural, timeAgo } from '../../lib/format.js';

const STALE_DAYS = 14;
const PAGE = 20;
const ICON = {
  open: <GitPullRequest size={16} className="text-green" aria-label="Open" />,
  merged: <GitMerge size={16} className="text-violet" aria-label="Merged" />,
  closed: <GitPullRequestClosed size={16} className="text-red" aria-label="Closed" />,
};

export function PullTable({ pulls }) {
  const [state, setState] = useState('all');
  const [query, setQuery] = useState('');
  const [oldestFirst, setOldestFirst] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const counts = useMemo(() => {
    const c = { all: pulls.length, open: 0, merged: 0, closed: 0 };
    pulls.forEach((p) => { c[p.state] += 1; });
    return c;
  }, [pulls]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = pulls.filter((p) => (state === 'all' || p.state === state)
      && (!q || p.title.toLowerCase().includes(q) || String(p.number).includes(q) || (p.authorLogin || '').toLowerCase().includes(q)));
    return oldestFirst ? [...filtered].reverse() : filtered;
  }, [pulls, state, query, oldestFirst]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
        <Segmented
          label="Filter by state" value={state} onChange={(v) => { setState(v); setShown(PAGE); }}
          options={['all', 'open', 'merged', 'closed'].map((v) => ({ value: v, label: `${v[0].toUpperCase()}${v.slice(1)} ${counts[v]}` }))}
        />
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search pull requests</span>
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
            <input
              type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
              placeholder="Search title, #, author"
              className="h-8 w-48 rounded-lg bg-surface pl-8 pr-2.5 text-[13px] shadow-[0_0_0_1px_var(--ring)] outline-none transition-shadow duration-150 placeholder:text-fg-faint focus:shadow-[0_0_0_2px_var(--accent)] sm:w-60"
            />
          </label>
          <Button size="icon" variant="secondary" onClick={() => setOldestFirst((v) => !v)} aria-label={oldestFirst ? 'Sorted oldest first' : 'Sorted newest first'} aria-pressed={oldestFirst}>
            <ArrowUpDown size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={GitPullRequest} title={pulls.length ? 'No matching pull requests' : 'No pull requests in this period'}>
          {pulls.length ? 'Try a different filter or search term.' : 'Try a longer range.'}
        </EmptyState>
      ) : (
        <ul className="hairline-t">
          {rows.slice(0, shown).map((p) => {
            const ageDays = (Date.now() - new Date(p.createdAt).getTime()) / 86400000;
            const lead = p.mergedAt ? (new Date(p.mergedAt) - new Date(p.createdAt)) / 3600000 : null;
            return (
              <li key={p.number} className="hairline-b flex items-center gap-3 px-4 py-3 transition-colors duration-150 last:shadow-none hover:bg-surface-2 sm:px-5">
                <span className="shrink-0">{ICON[p.state]}</span>
                <div className="min-w-0 flex-1">
                  <a href={p.htmlUrl} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium hover:underline" title={p.title}>{p.title}</a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                    <span className="num">#{p.number}</span>
                    <span className="inline-flex items-center gap-1.5"><Avatar login={p.authorLogin} size={14} />{p.authorLogin || 'unknown'}</span>
                    <span>opened {timeAgo(p.createdAt)}</span>
                  </p>
                </div>
                {p.state === 'open' && ageDays > STALE_DAYS && <Badge tone="amber" className="hidden sm:inline-flex">Stale · {plural(Math.floor(ageDays), 'day')}</Badge>}
                {lead !== null && <span className="num hidden shrink-0 text-xs text-fg-muted sm:block">merged in {formatHours(lead)}</span>}
                <Badge tone={p.state === 'open' ? 'green' : p.state === 'merged' ? 'violet' : 'red'} className="capitalize">{p.state}</Badge>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > shown && (
        <div className="hairline-t flex justify-center p-3">
          <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}</Button>
        </div>
      )}
    </Card>
  );
}
