import { Card, Empty } from './Card.jsx';
import { timeAgo } from '../lib/format.js';

const BADGE = {
  open: 'bg-green-100 text-green-700',
  merged: 'bg-violet-100 text-violet-700',
  closed: 'bg-red-100 text-red-700',
};

export default function PullRequestList({ pulls }) {
  return (
    <Card title="Recent pull requests" className="lg:col-span-2">
      {pulls.length === 0 ? (
        <Empty>No pull requests in this period.</Empty>
      ) : (
        <ul className="divide-y divide-slate-100">
          {pulls.slice(0, 8).map((p) => (
            <li key={p.number} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <a href={p.htmlUrl} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
                  #{p.number} {p.title}
                </a>
                <p className="text-xs text-slate-400">{p.authorLogin || 'unknown'} - opened {timeAgo(p.createdAt)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${BADGE[p.state]}`}>{p.state}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
