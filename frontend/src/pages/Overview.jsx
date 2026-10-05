import { Link, useLocation } from 'react-router-dom';
import { KpiGrid } from '../components/dashboard/KpiGrid.jsx';
import { ActivityChart } from '../components/charts/ActivityChart.jsx';
import { SignalsCard } from '../components/dashboard/SignalsCard.jsx';
import { Heatmap } from '../components/charts/Heatmap.jsx';
import { Punchcard } from '../components/charts/Punchcard.jsx';
import { PrStateChart } from '../components/charts/PrStateChart.jsx';
import { LeadTimeChart } from '../components/charts/LeadTimeChart.jsx';
import { ContributorsCard } from '../components/dashboard/ContributorsCard.jsx';
import { WaitingList } from '../components/dashboard/WaitingList.jsx';
import { AiReport } from '../components/dashboard/AiReport.jsx';
import { DataBanner } from '../components/dashboard/DataBanner.jsx';
import { useWorkspace } from '../state/workspace.jsx';
import { useDocumentTitle } from '../lib/hooks.js';

export default function Overview() {
  const { data, who, setWho, generate, generating, repo } = useWorkspace();
  const { summary, reports } = data;
  const rv = summary.reviews;
  const { search } = useLocation();
  useDocumentTitle(`${repo} · Overview`);
  const person = who ? summary.topContributors.find((p) => p.login === who) : null;

  return (
    <div className="space-y-3">
      <DataBanner summary={summary} />
      <KpiGrid summary={summary} />
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2"><ActivityChart summary={summary} who={who} onClearWho={() => setWho(null)} /></div>
        <SignalsCard summary={summary} />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Heatmap
            daily={summary.daily}
            values={person ? person.series : summary.daily.map((d) => d.commits)}
            description={person ? `Showing ${person.name || person.login} only` : undefined}
          />
        </div>
        <div className="lg:col-span-3"><Punchcard matrix={summary.punchcard} /></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {rv.available
            ? <WaitingList items={rv.waiting} total={rv.waitingCount} limit={4} footer={<Link to={{ pathname: '/dashboard/reviews', search }} className="mt-2 block px-2.5 text-xs font-medium text-accent hover:underline">All review metrics</Link>} />
            : <PrStateChart data={summary.pullRequestsByState} />}
        </div>
        <div className="lg:col-span-3"><LeadTimeChart summary={summary} /></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2"><ContributorsCard summary={summary} who={who} onSelect={setWho} limit={5} /></div>
        <div className="lg:col-span-3"><AiReport report={reports[0]} generating={generating} onGenerate={generate} compact /></div>
      </div>
    </div>
  );
}
