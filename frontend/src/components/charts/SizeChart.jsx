import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Ruler } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { EmptyState } from '../ui/States.jsx';
import { sizeInsight } from '../../lib/chartData.js';
import { formatHours, plural } from '../../lib/format.js';

function TipCard({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="font-medium text-fg-muted">{row.label} · {row.range}</p>
      <p className="num text-sm font-semibold">{row.medianMergeHours === null ? 'No merged PRs' : `${formatHours(row.medianMergeHours)} to merge`}</p>
      <p className="num text-fg-muted">{plural(row.mergedCount, 'merged PR')}</p>
    </div>
  );
}

/** Does PR size predict merge time here? The answer, as a chart and one honest sentence. */
export function SizeChart({ size }) {
  const data = size.buckets.map((b) => ({ ...b, hours: b.medianMergeHours ?? 0 }));
  const total = size.buckets.reduce((n, b) => n + b.mergedCount, 0);
  const insight = sizeInsight(size.buckets);

  return (
    <Card className="h-full">
      <CardHeader title="Size and merge time" description="Median time to merge by lines changed" />
      <CardBody>
        {total === 0 ? (
          <EmptyState icon={Ruler} title="No merged pull requests" className="h-56">Merged PRs appear here with their size.</EmptyState>
        ) : (
          <>
            {insight && (
              <p className="mb-3 text-[13px] leading-relaxed">
                {insight.kind === 'slower' ? (
                  <><span className="font-semibold">{insight.large.label} pull requests take {insight.ratio >= 10 ? Math.round(insight.ratio) : insight.ratio.toFixed(1)}× longer</span> to merge than {insight.small.label} ones ({formatHours(insight.large.medianMergeHours)} vs {formatHours(insight.small.medianMergeHours)}).</>
                ) : (
                  <>Merge time barely changes with size here ({formatHours(insight.small.medianMergeHours)} for {insight.small.label}, {formatHours(insight.large.medianMergeHours)} for {insight.large.label}).</>
                )}
              </p>
            )}
            <div role="img" aria-label={`Median time to merge by pull request size: ${size.buckets.filter((b) => b.mergedCount).map((b) => `${b.label} ${formatHours(b.medianMergeHours)}`).join(', ')}.`} style={{ height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--ring)" strokeDasharray="3 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--ring)' }} tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} tickMargin={8} interval={0} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} tickFormatter={(v) => formatHours(v)} />
                  <Tooltip isAnimationActive={false} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={<TipCard />} />
                  <Bar dataKey="hours" fill="var(--accent)" fillOpacity={0.85} radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-fg-faint">Buckets by lines changed (additions + deletions): {size.buckets.map((b) => `${b.label} ${b.range}`).join(' · ')}.</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
