import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { GitPullRequest } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { EmptyState } from '../ui/States.jsx';
import { cn } from '../../lib/cn.js';
import { formatNumber } from '../../lib/format.js';

const COLORS = { Merged: 'var(--violet)', Open: 'var(--green)', Closed: 'var(--red)' };

export function PrStateChart({ data }) {
  const [active, setActive] = useState(null);
  const total = data.reduce((n, d) => n + d.value, 0);

  return (
    <Card className="h-full">
      <CardHeader title="Pull request outcomes" description="Opened in this period" />
      <CardBody>
        {total === 0 ? (
          <EmptyState icon={GitPullRequest} title="No pull requests" className="h-52">Nothing was opened in this period.</EmptyState>
        ) : (
          <div className="flex flex-col items-center gap-5 sm:flex-row">
            <div className="relative h-44 w-44 shrink-0" role="img" aria-label={`Pull requests: ${data.map((d) => `${d.value} ${d.name.toLowerCase()}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={total > 1 ? 3 : 0} cornerRadius={4} stroke="none" isAnimationActive={false}>
                    {data.map((d, i) => (
                      <Cell
                        key={d.name} fill={COLORS[d.name]}
                        fillOpacity={active === null || active === i ? 1 : 0.25}
                        style={{ transition: 'fill-opacity 160ms ease', outline: 'none' }}
                        onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="num text-2xl font-semibold leading-none tracking-tight">{formatNumber(active === null ? total : data[active].value)}</p>
                  <p className="mt-1 text-xs text-fg-muted">{active === null ? 'total' : data[active].name.toLowerCase()}</p>
                </div>
              </div>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-1">
              {data.map((d, i) => (
                <li
                  key={d.name}
                  onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}
                  className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-150', active === i && 'bg-surface-2')}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[d.name] }} />
                  <span className="flex-1 text-[13px]">{d.name}</span>
                  <span className="num text-[13px] font-medium">{formatNumber(d.value)}</span>
                  <span className="num w-10 text-right text-xs text-fg-muted">{Math.round((d.value / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
