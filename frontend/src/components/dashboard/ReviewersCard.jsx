import { Users } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { EmptyState } from '../ui/States.jsx';
import { cn } from '../../lib/cn.js';
import { formatHours, plural } from '../../lib/format.js';

/** Who does the reviewing. When one person carries most of it, that is a bottleneck waiting to happen. */
export function ReviewersCard({ reviews, className }) {
  const { reviewers, reviewerCount, topReviewerShare } = reviews;
  const concentrated = reviewerCount > 1 && topReviewerShare >= 60;
  const max = Math.max(1, ...reviewers.map((r) => r.reviews));

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader title="Reviewer load" description={reviewerCount ? `${plural(reviewerCount, 'person', 'people')} reviewed pull requests in this period` : 'Who reviews pull requests'} />
      <CardBody className="px-2 sm:px-3">
        {concentrated && (
          <p role="status" className="mx-2 mb-2 rounded-lg bg-amber-soft px-3 py-2 text-[13px] text-amber">
            {reviewers[0].login} did {topReviewerShare}% of all reviews. If they are away, reviews stall.
          </p>
        )}
        {reviewers.length === 0 ? (
          <EmptyState icon={Users} title="No reviews yet">No one submitted a review in this period.</EmptyState>
        ) : (
          <ul className="space-y-0.5">
            {reviewers.map((r) => (
              <li key={r.login} className="rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-surface-2">
                <div className="flex items-center gap-3">
                  <Avatar login={r.login} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px] font-medium">{r.login}</span>
                      <span className="num shrink-0 text-xs text-fg-muted"><span className="text-[13px] font-semibold text-fg">{r.reviews}</span> reviews · {r.share}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(r.reviews / max) * 100}%` }} />
                    </div>
                    <p className="num mt-1 text-xs text-fg-muted">
                      {plural(r.prsReviewed, 'PR')} · {r.approvals} approved{r.changesRequested ? ` · ${r.changesRequested} changes requested` : ''} · first response {formatHours(r.medianResponseHours)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
