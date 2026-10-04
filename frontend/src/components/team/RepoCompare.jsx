import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card.jsx';
import { Delta } from '../ui/Delta.jsx';
import { Sparkline } from '../charts/Sparkline.jsx';
import { formatHours } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

// Missing values (no merged PRs, no reviews) always sort last, whichever direction is chosen.
const COLUMNS = [
  { key: 'fullName', label: 'Repository', get: (r) => r.fullName.toLowerCase(), align: 'left' },
  { key: 'commits', label: 'Commits', get: (r) => r.commits },
  { key: 'mergedPullRequests', label: 'Merged', get: (r) => r.mergedPullRequests },
  { key: 'openPullRequests', label: 'Open', get: (r) => r.openPullRequests },
  { key: 'medianMergeHours', label: 'Time to merge', get: (r) => r.medianMergeHours },
  { key: 'medianFirstReviewHours', label: 'First review', get: (r) => r.medianFirstReviewHours },
  { key: 'waitingForReview', label: 'Waiting', get: (r) => r.waitingForReview },
];

/** Every repository side by side. Click a header to sort; click a row to open that repository. */
export function RepoCompare({ repos, days, reviewsAvailable = true }) {
  const [sort, setSort] = useState({ key: 'commits', dir: 'desc' });
  const col = COLUMNS.find((c) => c.key === sort.key);

  const rows = useMemo(() => {
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...repos].sort((a, b) => {
      const x = col.get(a); const y = col.get(b);
      if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
      if (y === null || y === undefined) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sign;
    });
  }, [repos, col, sort.dir]);

  const header = (c) => {
    const active = sort.key === c.key;
    const Icon = sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('px-3 py-2 font-medium first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5', c.align === 'left' ? 'text-left' : 'text-right')}>
        <button
          onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}
          className={cn('press inline-flex items-center gap-1 rounded hover:text-fg', active && 'text-fg')}
        >
          {c.label}
          <Icon size={12} aria-hidden="true" className={active ? 'opacity-100' : 'opacity-0'} />
        </button>
      </th>
    );
  };

  return (
    <Card>
      <CardHeader title="Repositories compared" description={`Last ${days} days. Sorted by ${col.label.toLowerCase()}.`} />
      <div className="scroll-x mt-3">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="text-xs text-fg-muted">
            <tr className="hairline-b">
              {header(COLUMNS[0])}
              <th scope="col" className="px-3 py-2 text-left font-medium"><span className="sr-only">Commits per day</span></th>
              {COLUMNS.slice(1).map(header)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.fullName} className="hairline-b transition-colors duration-150 last:shadow-none hover:bg-surface-2">
                <th scope="row" className="max-w-64 truncate py-2.5 pl-4 pr-3 text-left font-normal sm:pl-5">
                  <Link to={{ pathname: '/dashboard', search: `?repo=${encodeURIComponent(r.fullName)}&range=${days}` }} className="hover:underline">
                    <span className="text-fg-muted">{r.fullName.split('/')[0]}/</span><span className="font-medium">{r.fullName.split('/')[1]}</span>
                  </Link>
                  {r.incomplete && <AlertTriangle size={12} className="ml-1.5 inline text-amber" aria-label="History is incomplete (busy repository)" />}
                </th>
                <td className="w-28 px-3"><div className="h-6 w-24"><Sparkline values={r.daily} height={24} label={`${r.fullName}: commits per day`} /></div></td>
                <td className="num px-3 text-right">
                  <span className="font-medium">{r.commits}</span>{' '}
                  <Delta className="ml-1 align-middle" current={r.commits} previous={r.previousCommits} />
                </td>
                <td className="num px-3 text-right">{r.mergedPullRequests}</td>
                <td className="num px-3 text-right">{r.openPullRequests}{r.stalePullRequests > 0 && <span className="text-amber" title="Open for more than 14 days"> · {r.stalePullRequests} stale</span>}</td>
                <td className="num px-3 text-right">{formatHours(r.medianMergeHours)}</td>
                <td className="num px-3 text-right">{reviewsAvailable ? formatHours(r.medianFirstReviewHours) : '-'}</td>
                <td className={cn('num px-3 pr-4 text-right sm:pr-5', r.waitingForReview > 0 && 'font-medium text-amber')}>{r.waitingForReview}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
