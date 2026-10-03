import { AlertTriangle } from 'lucide-react';
import { formatDay } from '../../lib/format.js';

/** Says so out loud when GitHub's pagination limit means the older part of the range is incomplete. */
export function DataBanner({ summary }) {
  const q = summary.dataQuality;
  if (!q?.incomplete) return null;
  return (
    <div role="status" className="mb-3 flex items-start gap-2.5 rounded-lg bg-amber-soft px-4 py-2.5 text-[13px] text-amber">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        This repository is very busy. DevPulse reads the most recent 1,000 commits, so activity before{' '}
        <span className="num font-semibold">{formatDay(q.historyFrom.slice(0, 10))}</span> is incomplete and totals for longer ranges are understated.
      </p>
    </div>
  );
}
