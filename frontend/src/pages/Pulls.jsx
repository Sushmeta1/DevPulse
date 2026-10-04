import { PullTable } from '../components/dashboard/PullTable.jsx';
import { PrStateChart } from '../components/charts/PrStateChart.jsx';
import { LeadTimeChart } from '../components/charts/LeadTimeChart.jsx';
import { DataBanner } from '../components/dashboard/DataBanner.jsx';
import { useWorkspace } from '../state/workspace.jsx';
import { useDocumentTitle } from '../lib/hooks.js';
import { formatNumber } from '../lib/format.js';
import { cn } from '../lib/cn.js';

function Tile({ label, value, hint, tone }) {
  return (
    <div className="card p-4">
      <p className="text-[13px] text-fg-muted">{label}</p>
      <p className={cn('num mt-1 text-2xl font-semibold tracking-tight', tone)}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-fg-faint">{hint}</p>
    </div>
  );
}

export default function Pulls() {
  const { data, repo } = useWorkspace();
  const { summary, pulls } = data;
  const t = summary.totals;
  useDocumentTitle(`${repo} · Pull requests`);

  return (
    <div className="space-y-3">
      <DataBanner summary={summary} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Open now" value={formatNumber(t.openPullRequests)} hint="Across the whole repository" tone="text-green" />
        <Tile label="Merged" value={formatNumber(t.mergedPullRequests)} hint={t.mergeRate === null ? 'In this period' : `${t.mergeRate}% of finished PRs`} tone="text-violet" />
        <Tile label="Closed unmerged" value={formatNumber(t.closedPullRequests)} hint="Opened in this period" tone="text-red" />
        <Tile
          label="Stale" value={formatNumber(t.stalePullRequests)} tone={t.stalePullRequests ? 'text-amber' : undefined}
          hint={t.stalePullRequests ? `Oldest open ${t.oldestOpenDays} days` : 'Nothing open for 14+ days'}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2"><PrStateChart data={summary.pullRequestsByState} /></div>
        <div className="lg:col-span-3"><LeadTimeChart summary={summary} /></div>
      </div>
      <PullTable key={repo} pulls={pulls} />
    </div>
  );
}
