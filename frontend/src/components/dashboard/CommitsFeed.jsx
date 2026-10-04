import { Check, Copy, GitCommitHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { EmptyState } from '../ui/States.jsx';
import { Tooltip } from '../ui/Tooltip.jsx';
import { timeAgo } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';
import { useState } from 'react';

function CopySha({ sha }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sha);
      setDone(true);
      toast.success('Commit SHA copied');
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };
  return (
    <Tooltip content="Copy full SHA">
      <button onClick={copy} className="press mono inline-flex h-6 items-center gap-1.5 rounded-md bg-surface-2 px-1.5 text-[11px] text-fg-muted hover:text-fg" aria-label={`Copy commit ${sha.slice(0, 7)}`}>
        {sha.slice(0, 7)}
        {done ? <Check size={11} className="text-green" aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      </button>
    </Tooltip>
  );
}

export function CommitsFeed({ commits, limit = 8, className }) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader title="Recent commits" description="Latest activity on the default branch" />
      <CardBody className="px-2 sm:px-3">
        {commits.length === 0 ? (
          <EmptyState icon={GitCommitHorizontal} title="No commits in this period">Try a longer range.</EmptyState>
        ) : (
          <ul>
            {commits.slice(0, limit).map((c) => (
              <li key={c.sha} className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors duration-150 hover:bg-surface-2">
                <Avatar login={c.authorLogin} name={c.authorName} size={28} />
                <div className="min-w-0 flex-1">
                  <a href={c.htmlUrl} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium hover:underline" title={c.message}>
                    {c.message || '(no message)'}
                  </a>
                  <p className="truncate text-xs text-fg-muted">{c.authorName || c.authorLogin || 'Unknown'} · {timeAgo(c.committedAt)}</p>
                </div>
                <CopySha sha={c.sha} />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
