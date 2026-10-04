import { Skeleton } from '../ui/Skeleton.jsx';
import { KpiSkeleton } from './KpiGrid.jsx';

/** Same grid as the Overview so nothing jumps when data arrives. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading repository activity">
      <KpiSkeleton />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2"><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-8 w-32" /><Skeleton className="mt-6 h-64 w-full" /></div>
        <div className="card p-5">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="mt-5 h-9 w-full" />)}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-2"><Skeleton className="h-4 w-32" /><Skeleton className="mt-5 h-40 w-full" /></div>
        <div className="card p-5 lg:col-span-3"><Skeleton className="h-4 w-32" /><Skeleton className="mt-5 h-40 w-full" /></div>
      </div>
    </div>
  );
}
