import { CheckCircle2, GitPullRequest } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { EmptyState } from '../ui/States.jsx';
import { cn } from '../../lib/cn.js';
import { formatHours, plural } from '../../lib/format.js';

// How long is too long: a day is a miss, three days is a problem.
const tone = (hours) => (hours > 72 ? 'bg-red-soft text-red' : hours > 24 ? 'bg-amber-soft text-amber' : 'bg-surface-2 text-fg-muted');

/** Open pull requests nobody has reviewed yet, longest wait first - the one list on the dashboard you can act on. */
export function WaitingList({ items, total, showRepo = false, limit = 6, className, footer }) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader
        title="Waiting for a first review"
        description={total ? `${plural(total, 'pull request')} with no human review yet` : 'Open pull requests nobody has reviewed'}
      />
      <CardBody className="px-2 sm:px-3">
        {items.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing is waiting" className="py-10">Every open pull request has had a first review.</EmptyState>
        ) : (
          <ul>
            {items.slice(0, limit).map((w) => (
              <li key={`${w.repo ?? ''}#${w.number}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-surface-2">
                <GitPullRequest size={16} className="shrink-0 text-green" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <a href={w.htmlUrl} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium hover:underline" title={w.title}>{w.title}</a>
                  <p className="flex items-center gap-1.5 truncate text-xs text-fg-muted">
                    {showRepo && w.repo && <span className="truncate">{w.repo}</span>}
                    <span className="num">#{w.number}</span>
                    <Avatar login={w.authorLogin} size={14} />{w.authorLogin || 'unknown'}
                  </p>
                </div>
                <span className={cn('num shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', tone(w.hoursWaiting))}>
                  <span className="sr-only">Waiting </span>{formatHours(w.hoursWaiting)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {total > limit && <p className="px-2.5 pt-2 text-xs text-fg-faint">and {total - limit} more</p>}
        {footer}
      </CardBody>
    </Card>
  );
}
