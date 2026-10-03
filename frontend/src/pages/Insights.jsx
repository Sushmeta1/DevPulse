import { useEffect, useState } from 'react';
import { AiReport } from '../components/dashboard/AiReport.jsx';
import { SignalsCard } from '../components/dashboard/SignalsCard.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { DataBanner } from '../components/dashboard/DataBanner.jsx';
import { useWorkspace } from '../state/workspace.jsx';
import { useDocumentTitle } from '../lib/hooks.js';
import { timeAgo } from '../lib/format.js';
import { cn } from '../lib/cn.js';

export default function Insights() {
  const { data, generate, generating, repo } = useWorkspace();
  const { summary, reports } = data;
  const [selectedId, setSelectedId] = useState(null);
  useDocumentTitle(`${repo} · Insights`);

  // A freshly generated report becomes the one on screen.
  useEffect(() => { setSelectedId(null); }, [reports[0]?.id, repo]);
  const report = reports.find((r) => r.id === selectedId) ?? reports[0];

  return (
    <div className="space-y-3">
      <DataBanner summary={summary} />
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <AiReport report={report} generating={generating} onGenerate={generate} />
          {reports.length > 1 && (
            <Card>
              <CardHeader title="Previous summaries" description="Select one to read it again" />
              <CardBody className="px-2 sm:px-3">
                <ul>
                  {reports.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => setSelectedId(r.id)}
                        aria-pressed={r.id === report.id}
                        className={cn('press flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2', r.id === report.id && 'bg-accent-soft hover:bg-accent-soft')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{r.content.summary}</span>
                          <span className="text-xs text-fg-muted">Last {r.days} days · {timeAgo(r.createdAt)}</span>
                        </span>
                        <Badge tone={r.provider === 'local' ? 'neutral' : 'accent'}>{r.provider === 'local' ? 'Rule-based' : r.provider}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
        <div className="lg:col-span-2"><SignalsCard summary={summary} /></div>
      </div>
    </div>
  );
}
