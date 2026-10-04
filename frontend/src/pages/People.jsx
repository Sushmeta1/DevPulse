import { ContributorsCard } from '../components/dashboard/ContributorsCard.jsx';
import { Heatmap } from '../components/charts/Heatmap.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { DataBanner } from '../components/dashboard/DataBanner.jsx';
import { useWorkspace } from '../state/workspace.jsx';
import { useDocumentTitle } from '../lib/hooks.js';
import { formatNumber, plural } from '../lib/format.js';

export default function People() {
  const { data, who, setWho, repo } = useWorkspace();
  const { summary } = data;
  useDocumentTitle(`${repo} · Contributors`);
  const person = who ? summary.topContributors.find((p) => p.login === who) : null;
  const shown = summary.topContributors.length;

  return (
    <div className="space-y-3">
      <DataBanner summary={summary} />
      <div className="grid items-start gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ContributorsCard summary={summary} who={who} onSelect={setWho} limit={8} wide />
          {summary.totals.contributors > shown && (
            <p className="mt-2 px-1 text-xs text-fg-faint">Showing the top {shown} of {formatNumber(summary.totals.contributors)} contributors.</p>
          )}
        </div>
        <div className="space-y-3 lg:col-span-2">
          <Card>
            <CardBody className="pt-4 sm:pt-5">
              {person ? (
                <div className="fade-in" key={person.login}>
                  <div className="flex items-center gap-3">
                    <Avatar login={person.linked ? person.login : null} name={person.name || person.login} size={40} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{person.name || person.login}</p>
                      <p className="truncate text-xs text-fg-muted">{person.linked ? `@${person.login}` : 'No linked GitHub account'}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    {[['Commits', person.commits], ['Pull requests', person.pullRequests], ['Active days', person.activeDays]].map(([k, v]) => (
                      <div key={k}><dt className="text-xs text-fg-muted">{k}</dt><dd className="num text-xl font-semibold tracking-tight">{formatNumber(v)}</dd></div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-fg-muted">
                    {Math.round((person.commits / Math.max(1, summary.totals.commits)) * 100)}% of the {plural(summary.totals.commits, 'commit')} in this period.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold">Everyone</p>
                  <p className="mt-1 text-[13px] text-fg-muted">Select a contributor to see their activity here and to filter the Overview chart.</p>
                </div>
              )}
            </CardBody>
          </Card>
          <Heatmap
            daily={summary.daily}
            values={person ? person.series : summary.daily.map((d) => d.commits)}
            description={person ? `${person.name || person.login}'s commits` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
