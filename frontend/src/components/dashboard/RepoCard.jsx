import { Link } from 'react-router-dom';
import { GitFork, GitPullRequest, Lock, Star } from 'lucide-react';
import { Sparkline } from '../charts/Sparkline.jsx';
import { Badge } from '../ui/Badge.jsx';
import { formatCompact, hueFor, plural, timeAgo } from '../../lib/format.js';

export function RepoCard({ repo, range, index = 0, animate = false }) {
  return (
    <Link
      to={{ pathname: '/dashboard', search: `?repo=${encodeURIComponent(repo.fullName)}&range=${range}` }}
      className={`card press group flex min-w-0 flex-col p-4 transition-shadow duration-150 hover:shadow-[0_0_0_1px_var(--ring-strong)] sm:p-5 ${animate ? 'rise' : ''}`}
      style={{ '--i': Math.min(index, 12) }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-sm font-semibold leading-snug">
          <span className="text-fg-muted">{repo.owner}/</span>{repo.name}
        </h3>
        {repo.isPrivate && <Badge className="shrink-0"><Lock size={10} aria-hidden="true" /> Private</Badge>}
      </div>
      <p className="mt-1 line-clamp-2 min-h-9 text-[13px] leading-snug text-fg-muted">{repo.description || 'No description provided.'}</p>

      <div className="mt-3 h-10">
        {repo.synced ? (
          <Sparkline values={repo.activity} height={40} label={`${repo.fullName}: commits per day, last 30 days`} />
        ) : (
          <div className="grid h-full place-items-center rounded-md border border-dashed border-[var(--ring-strong)] text-xs text-fg-faint">
            Not analyzed yet - open to sync
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-fg-muted">
        {repo.synced ? (
          <span className="num flex items-center gap-3">
            <span className="font-medium text-fg">{plural(repo.commits30, 'commit')}</span>
            <span className="inline-flex items-center gap-1"><GitPullRequest size={12} aria-hidden="true" />{repo.openPulls} open</span>
          </span>
        ) : <span>{repo.pushedAt ? `Pushed ${timeAgo(repo.pushedAt)}` : 'No pushes yet'}</span>}
        <span className="flex shrink-0 items-center gap-3">
          {repo.language && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${hueFor(repo.language)} 65% 55%)` }} aria-hidden="true" />{repo.language}
            </span>
          )}
          <span className="num inline-flex items-center gap-1"><Star size={12} aria-hidden="true" />{formatCompact(repo.stars)}</span>
          <span className="num hidden items-center gap-1 sm:inline-flex"><GitFork size={12} aria-hidden="true" />{formatCompact(repo.forks)}</span>
        </span>
      </div>
    </Link>
  );
}
