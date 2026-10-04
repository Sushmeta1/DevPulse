import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { cn } from '../../lib/cn.js';
import { deriveSignals } from '../../lib/signals.js';

const TONE = { good: 'bg-green', warn: 'bg-amber', bad: 'bg-red', neutral: 'bg-fg-faint' };
const TEXT = { good: 'text-green', warn: 'text-amber', bad: 'text-red', neutral: 'text-fg-muted' };
const WORD = { good: 'Healthy', warn: 'Watch', bad: 'Needs attention', neutral: 'No data' };

export function SignalsCard({ summary, className }) {
  const signals = deriveSignals(summary);
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader title="Team signals" description="Plain-English health checks from your data" />
      <CardBody className="pt-2">
        <ul className="divide-y divide-[var(--ring)]">
          {signals.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-3">
              <span className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', TONE[s.status])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium">{s.label}</p>
                  <p className="num shrink-0 text-[13px] font-semibold">{s.value}</p>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{s.detail}</p>
                <p className={cn('sr-only')}>{WORD[s.status]}</p>
              </div>
              <span className={cn('hidden shrink-0 pt-0.5 text-[11px] font-medium sm:block', TEXT[s.status])} aria-hidden="true">{WORD[s.status]}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
