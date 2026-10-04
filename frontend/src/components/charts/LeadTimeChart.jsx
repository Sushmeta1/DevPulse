import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GitMerge } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { EmptyState } from '../ui/States.jsx';
import { Delta } from '../ui/Delta.jsx';
import { formatHours, plural } from '../../lib/format.js';

const BUCKET_MAX = [1, 4, 24, 72, 168, Infinity];

function TipCard({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="font-medium text-fg-muted">Merged within {row.label}</p>
      <p className="num text-sm font-semibold">{plural(row.count, 'pull request')}</p>
    </div>
  );
}

export function LeadTimeChart({ summary }) {
  const { leadTime, totals: t, previous } = summary;
  const total = leadTime.reduce((n, b) => n + b.count, 0);
  const medianBucket = t.medianMergeHours === null ? -1 : BUCKET_MAX.findIndex((m) => t.medianMergeHours < m);

  return (
    <Card className="h-full">
      <CardHeader title="Time to merge" description="How long pull requests wait before they land" />
      <CardBody>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[
            ['Median', formatHours(t.medianMergeHours), <Delta key="d" current={t.medianMergeHours} previous={previous?.medianMergeHours} goodWhen="down" />],
            ['Slowest 10%', formatHours(t.p90MergeHours)],
            ['Merge rate', t.mergeRate === null ? '-' : `${t.mergeRate}%`],
          ].map(([label, value, extra]) => (
            <div key={label}>
              <p className="text-xs text-fg-muted">{label}</p>
              <p className="num text-xl font-semibold tracking-tight">{value}</p>
              {extra}
            </div>
          ))}
        </div>
        {total === 0 ? (
          <EmptyState icon={GitMerge} title="No merged pull requests" className="h-44">Nothing was merged in this period.</EmptyState>
        ) : (
          <div role="img" aria-label={`Merged pull requests by time to merge. Median ${formatHours(t.medianMergeHours)}.`} style={{ height: 176 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadTime} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--ring)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--ring)' }} tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} tickMargin={8} interval={0} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} />
                <Tooltip isAnimationActive={false} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={<TipCard />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
                  {leadTime.map((b, i) => <Cell key={b.label} fill={i === medianBucket ? 'var(--violet)' : 'var(--accent)'} fillOpacity={i === medianBucket ? 1 : 0.55} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {medianBucket >= 0 && <p className="mt-2 text-xs text-fg-faint"><span className="inline-block h-2 w-2 rounded-sm bg-violet align-middle" /> Highlighted bar contains the median.</p>}
      </CardBody>
    </Card>
  );
}
