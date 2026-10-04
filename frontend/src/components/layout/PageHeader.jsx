import { RefreshCw, Lock, Star, GitFork, Code2, FolderSearch, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../ui/States.jsx';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton.jsx';
import { useCommandMenu } from './CommandMenu.jsx';
import { RANGES, useWorkspace } from '../../state/workspace.jsx';
import { formatCompact, timeAgo } from '../../lib/format.js';

export function PageHeader() {
  const ws = useWorkspace();
  const { repoMeta, repo, data } = ws;
  const [owner, name] = (repo || '').split('/');
  const refreshing = ws.status === 'refreshing' || ws.status === 'loading';

  if (!repo) {
    return <div className="mb-6"><Skeleton className="h-7 w-64" /><Skeleton className="mt-3 h-4 w-96 max-w-full" /></div>;
  }
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 flex-1 basis-80">
        <h1 className="flex flex-wrap items-baseline gap-x-1 text-2xl font-semibold tracking-tight">
          <span className="text-fg-muted">{owner}/</span>{name}
          {repoMeta?.isPrivate && <Badge className="ml-2 self-center"><Lock size={10} aria-hidden="true" /> Private</Badge>}
        </h1>
        <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{repoMeta?.description || 'No description provided.'}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          {repoMeta?.language && <span className="inline-flex items-center gap-1.5"><Code2 size={13} aria-hidden="true" />{repoMeta.language}</span>}
          {repoMeta && <span className="num inline-flex items-center gap-1.5"><Star size={13} aria-hidden="true" />{formatCompact(repoMeta.stars)}</span>}
          {repoMeta && <span className="num inline-flex items-center gap-1.5"><GitFork size={13} aria-hidden="true" />{formatCompact(repoMeta.forks)}</span>}
          {data?.summary.lastSyncedAt && <span>Synced {timeAgo(data.summary.lastSyncedAt)}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Segmented label="Time range" value={ws.days} onChange={ws.setDays} options={RANGES.map((d) => ({ value: d, label: `${d}d` }))} />
        <Button icon={RefreshCw} loading={refreshing} onClick={ws.refresh} aria-label="Refresh data from GitHub">
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  );
}

/** Decides what the page body shows: skeleton, error, empty, or the real content. */
export function DashboardGate({ children }) {
  const ws = useWorkspace();
  const { open } = useCommandMenu();

  if (ws.repos.status === 'error') return <ErrorState error={ws.repos.error} onRetry={ws.retry} />;
  if (ws.repos.status === 'ready' && ws.repos.list.length === 0) {
    return <EmptyState icon={FolderSearch} title="No repositories found" className="card py-16">Your GitHub account has no repositories DevPulse can read yet.</EmptyState>;
  }
  if (ws.status === 'error' && !ws.data) {
    const missing = ws.error?.status === 404;
    return (
      <div className="card">
        {missing ? (
          <EmptyState icon={AlertCircle} title="Repository not found" className="py-16" action={<Button variant="primary" onClick={() => open('click')}>Choose a repository</Button>}>
            {ws.repo} doesn&apos;t exist or your account can&apos;t access it.
          </EmptyState>
        ) : <ErrorState error={ws.error} onRetry={ws.retry} />}
      </div>
    );
  }
  if (!ws.data) return <DashboardSkeleton />;

  return (
    <div className="swap" data-pending={ws.status === 'refreshing'} aria-busy={ws.status === 'refreshing'}>
      {ws.status === 'error' && <p role="alert" className="mb-3 rounded-lg bg-red-soft px-4 py-2.5 text-[13px] text-red">{ws.error?.message}</p>}
      {children}
    </div>
  );
}
