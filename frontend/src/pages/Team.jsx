import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Boxes, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { KpiGrid, KpiSkeleton } from '../components/dashboard/KpiGrid.jsx';
import { ActivityChart } from '../components/charts/ActivityChart.jsx';
import { SignalsCard } from '../components/dashboard/SignalsCard.jsx';
import { WaitingList } from '../components/dashboard/WaitingList.jsx';
import { ReviewersCard } from '../components/dashboard/ReviewersCard.jsx';
import { ContributorsCard } from '../components/dashboard/ContributorsCard.jsx';
import { RepoCompare } from '../components/team/RepoCompare.jsx';
import { RepoPicker } from '../components/team/RepoPicker.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Segmented } from '../components/ui/Segmented.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../components/ui/States.jsx';
import { RANGES, useWorkspace } from '../state/workspace.jsx';
import { useAuth } from '../state/auth.jsx';
import { useAsync } from '../lib/useAsync.js';
import { useDocumentTitle } from '../lib/hooks.js';
import { api } from '../services/api.js';
import { plural } from '../lib/format.js';

function TeamSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading team view">
      <KpiSkeleton />
      <div className="card p-5"><Skeleton className="h-4 w-32" /><Skeleton className="mt-4 h-56 w-full" /></div>
      <div className="card p-5"><Skeleton className="h-4 w-40" /><Skeleton className="mt-4 h-40 w-full" /></div>
    </div>
  );
}

export default function Team() {
  useDocumentTitle('Team');
  const ws = useWorkspace();
  const { signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const [nonce, setNonce] = useState(0);
  const force = useRef(false);

  const picked = (params.get('repos') || '').split(',').filter(Boolean);
  const key = `team|${picked.join(',')}|${ws.days}|${nonce}`;

  const res = useAsync(async (signal) => {
    const refresh = force.current;
    force.current = false;
    const data = await api.team(picked, ws.days, refresh, signal);
    if (refresh) toast.success('Synced with GitHub');
    return data;
  }, key);

  const expired = res.error?.status === 401;
  useEffect(() => {
    if (expired) { toast.error('Your session expired. Please sign in again.'); signOut(); }
  }, [expired, signOut]);

  const setRepos = (names) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (names.length) next.set('repos', names.join(',')); else next.delete('repos');
    return next;
  });

  const data = res.value;
  const loading = !res.settled;
  const failed = res.error && !data;
  const inView = picked.length ? picked : (data?.repos.map((r) => r.fullName) ?? []);
  const rv = data?.aggregate.reviews;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-80">
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {data ? `${plural(data.repos.length, 'repository', 'repositories')} combined. ` : ''}
            Delivery and review health across your repositories - the numbers GitHub only shows one repository at a time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="Time range" value={ws.days} onChange={ws.setDays} options={RANGES.map((d) => ({ value: d, label: `${d}d` }))} />
          <RepoPicker repos={ws.repos.list} selected={inView} onApply={setRepos} />
          <Button icon={RefreshCw} loading={loading} onClick={() => { force.current = true; setNonce((n) => n + 1); }} aria-label="Refresh data from GitHub">
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {failed && <div className="card"><ErrorState error={res.error} onRetry={() => setNonce((n) => n + 1)} /></div>}
      {!failed && !data && <TeamSkeleton />}

      {data && data.repos.length === 0 && (
        <div className="card">
          <EmptyState
            icon={Boxes} title={data.skipped.length ? 'No repositories could be read' : 'No repositories in this view yet'} className="py-16"
            action={<RepoPicker repos={ws.repos.list} selected={[]} onApply={setRepos} />}
          >
            {data.skipped.length ? data.skipped[0].reason : 'Choose the repositories you want to see together. Repositories you open on their own are included automatically.'}
          </EmptyState>
        </div>
      )}

      {data && data.repos.length > 0 && (
        <div className="swap space-y-3" data-pending={loading} aria-busy={loading}>
          {res.error && <p role="alert" className="rounded-lg bg-red-soft px-4 py-2.5 text-[13px] text-red">{res.error.message}</p>}
          {data.skipped.length > 0 && (
            <div role="status" className="flex items-start gap-2.5 rounded-lg bg-amber-soft px-4 py-2.5 text-[13px] text-amber">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p>{plural(data.skipped.length, 'repository', 'repositories')} left out:</p>
                <ul className="mt-0.5 list-disc pl-4">
                  {data.skipped.map((s) => <li key={s.repo}><span className="font-medium">{s.repo}</span> - {s.reason}</li>)}
                </ul>
              </div>
            </div>
          )}
          {data.aggregate.dataQuality.incomplete && (
            <div role="status" className="flex items-start gap-2.5 rounded-lg bg-amber-soft px-4 py-2.5 text-[13px] text-amber">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                {data.aggregate.dataQuality.incompleteRepos.join(', ')} {data.aggregate.dataQuality.incompleteRepos.length === 1 ? 'is' : 'are'} very busy: only the most recent
                1,000 commits are read, so older activity is understated and period comparisons are hidden.
              </p>
            </div>
          )}
          <KpiGrid summary={data.aggregate} />
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2"><ActivityChart summary={data.aggregate} who={null} onClearWho={() => {}} /></div>
            <SignalsCard summary={data.aggregate} />
          </div>
          <RepoCompare repos={data.repos} days={ws.days} reviewsAvailable={rv.available} />
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {rv.available
                ? <WaitingList items={rv.waiting} total={rv.waitingCount} showRepo limit={8} />
                : <div className="card h-full"><EmptyState title="Collecting review data" className="py-12">Review data appears after each repository finishes its first full sync.</EmptyState></div>}
            </div>
            <div className="lg:col-span-2">{rv.available && <ReviewersCard reviews={rv} />}</div>
          </div>
          <ContributorsCard summary={data.aggregate} who={null} onSelect={() => {}} limit={8} wide />
          <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-fg-muted" aria-hidden="true" />
              <p className="text-[13px]"><span className="font-medium">Get this every Monday.</span> <span className="text-fg-muted">Send it to Slack or your inbox.</span></p>
            </div>
            <Link to={{ pathname: '/dashboard/digest', search: picked.length ? `?repos=${encodeURIComponent(picked.join(','))}` : '' }} className="press inline-flex h-8 items-center rounded-lg bg-surface px-3 text-[13px] font-medium shadow-[0_0_0_1px_var(--ring)] hover:bg-surface-2">
              Set up weekly digest
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
