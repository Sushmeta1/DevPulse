import { Clock3, Hourglass, MessagesSquare, Zap } from 'lucide-react';
import { WaitingList } from '../components/dashboard/WaitingList.jsx';
import { FirstReviewChart } from '../components/charts/FirstReviewChart.jsx';
import { SizeChart } from '../components/charts/SizeChart.jsx';
import { ReviewersCard } from '../components/dashboard/ReviewersCard.jsx';
import { DataBanner } from '../components/dashboard/DataBanner.jsx';
import { Delta } from '../components/ui/Delta.jsx';
import { EmptyState } from '../components/ui/States.jsx';
import { useWorkspace } from '../state/workspace.jsx';
import { useDocumentTitle } from '../lib/hooks.js';
import { formatHours, plural } from '../lib/format.js';
import { cn } from '../lib/cn.js';

function Tile({ icon: Icon, label, value, hint, children, tone }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="flex items-center gap-2 text-[13px] font-medium text-fg-muted"><Icon size={14} aria-hidden="true" />{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        <span className={cn('num text-[28px] font-semibold leading-none tracking-tight', tone)}>{value}</span>
        {children}
      </div>
      <p className="mt-1.5 truncate text-xs text-fg-muted">{hint}</p>
    </div>
  );
}

export default function Reviews() {
  const { data, repo } = useWorkspace();
  const { summary } = data;
  const rv = summary.reviews;
  useDocumentTitle(`${repo} · Reviews`);

  if (!rv.available) {
    return (
      <div className="card">
        <EmptyState icon={Hourglass} title="Collecting review data" className="py-16">
          DevPulse is reading the reviews on this repository&apos;s pull requests for the first time. Refresh in a moment.
        </EmptyState>
      </div>
    );
  }
  const f = rv.firstReview;
  const waitingTone = rv.waitingCount === 0 ? 'text-green' : rv.waiting[0].hoursWaiting > 72 ? 'text-red' : 'text-amber';

  return (
    <div className="space-y-3">
      <DataBanner summary={summary} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Clock3} label="Median first review" value={formatHours(f.medianHours)} hint={f.p90Hours === null ? 'No reviewed pull requests' : `Slowest 10%: ${formatHours(f.p90Hours)}`}>
          <Delta current={f.medianHours} previous={rv.previousMedianHours} goodWhen="down" />
        </Tile>
        <Tile icon={Zap} label="Reviewed within a day" value={f.withinDayPct === null ? '-' : `${f.withinDayPct}%`} hint={`${plural(f.reviewedCount, 'pull request')} got a review`} />
        <Tile icon={Hourglass} label="Waiting now" value={rv.waitingCount} tone={waitingTone} hint={rv.waitingCount ? `Longest wait: ${formatHours(rv.waiting[0].hoursWaiting)}` : 'Nothing is waiting'} />
        <Tile icon={MessagesSquare} label="Reviews, top reviewer" value={rv.topReviewerShare === null ? '-' : `${rv.topReviewerShare}%`} hint={rv.reviewerCount ? `${plural(rv.totalReviews, 'review')} by ${plural(rv.reviewerCount, 'person', 'people')}` : 'No reviews in this period'} />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3"><WaitingList items={rv.waiting} total={rv.waitingCount} limit={8} /></div>
        <div className="lg:col-span-2"><FirstReviewChart reviews={rv} /></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2"><ReviewersCard reviews={rv} /></div>
        <div className="lg:col-span-3"><SizeChart size={summary.size} /></div>
      </div>
      <p className="px-1 text-xs text-fg-faint">
        Drafts, bot-authored pull requests and reviews by the author or by bots are not counted. Time is measured from when the pull request was opened.
      </p>
    </div>
  );
}
