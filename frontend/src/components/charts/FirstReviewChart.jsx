import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MessageSquareText } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { EmptyState } from '../ui/States.jsx';
import { formatHours, plural } from '../../lib/format.js';

const BUCKET_MAX = [1, 4, 24, 72, 168, Infinity]; // matches the server's histogram buckets

function TipCard({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="font-medium text-fg-muted">First review within {row.label}</p>
      <p className="num text-sm font-semibold">{plural(row.count, 'pull request')}</p>
    </div>
  );
}

export function FirstReviewChart({ reviews }) {
  const { firstReview: f } = reviews;
  const total = f.distribution.reduce((n, b) => n + b.count, 0);
  const medianBucket = f.medianHours === null ? -1 : BUCKET_MAX.findIndex((m) => f.medianHours < m);

  return (
    <Card className="h-full">
      <CardHeader title="Time to first review" description="How long a pull request waits before anyone looks at it" />
      <CardBody>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[['Median', formatHours(f.medianHours)], ['Slowest 10%', formatHours(f.p90Hours)], ['Within a day', f.withinDayPct === null ? '-' : `${f.withinDayPct}%`]].map(([k, v]) => (
            <div key={k}><p className="text-xs text-fg-muted">{k}</p><p className="num text-xl font-semibold tracking-tight">{v}</p></div>
          ))}
        </div>
        {total === 0 ? (
          <EmptyState icon={MessageSquareText} title="No reviewed pull requests" className="h-44">Nothing received a first review in this period.</EmptyState>
        ) : (
          <div role="img" aria-label={`Pull requests by time to first review. Median ${formatHours(f.medianHours)}.`} style={{ height: 176 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={f.distribution} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--ring)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--ring)' }} tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} tickMargin={8} interval={0} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--fg-faint)' }} />
                <Tooltip isAnimationActive={false} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} content={<TipCard />} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={44}>
                  {f.distribution.map((b, i) => <Cell key={b.label} fill={i === medianBucket ? 'var(--violet)' : 'var(--accent)'} fillOpacity={i === medianBucket ? 1 : 0.55} />)}
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
