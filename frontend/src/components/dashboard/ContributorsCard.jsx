import { Users } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../ui/Card.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { EmptyState } from '../ui/States.jsx';
import { Sparkline } from '../charts/Sparkline.jsx';
import { cn } from '../../lib/cn.js';
import { formatNumber, plural } from '../../lib/format.js';

export function ContributorRow({ person, max, total, selected, onSelect, wide }) {
  const share = total ? Math.round((person.commits / total) * 100) : 0;
  return (
    <li>
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'press group grid w-full items-center gap-x-3 gap-y-1.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2',
          selected && 'bg-accent-soft hover:bg-accent-soft',
          wide ? 'grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_96px_auto]' : 'grid-cols-[auto_minmax(0,1fr)_auto]',
        )}
      >
        <Avatar login={person.linked ? person.login : null} name={person.name || person.login} size={28} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium">{person.name || person.login}</span>
          <span className="block truncate text-xs text-fg-muted">
            {person.linked ? `@${person.login}` : 'No linked GitHub account'}
          </span>
        </span>
        {wide && (
          <span className="hidden min-w-0 sm:block" aria-hidden="true">
            <span className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="bg-accent" style={{ width: `${(person.commits / max) * 100}%` }} />
              <span className="bg-green" style={{ width: `${(person.pullRequests / max) * 100}%` }} />
            </span>
            <span className="num mt-1 block text-[11px] text-fg-faint">{share}% of commits</span>
          </span>
        )}
        {wide && <span className="hidden w-24 sm:block"><Sparkline values={person.series} height={28} label={`${person.login} activity`} /></span>}
        <span className="num text-right text-xs text-fg-muted">
          <span className="block text-[13px] font-semibold text-fg">{formatNumber(person.commits)}</span>
          {plural(person.pullRequests, 'PR')}
        </span>
      </button>
    </li>
  );
}

export function ContributorsCard({ summary, who, onSelect, limit = 5, wide = false, className }) {
  const people = summary.topContributors.slice(0, limit);
  const max = Math.max(1, ...summary.topContributors.map((p) => p.commits + p.pullRequests));
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader title="Top contributors" description={who ? 'Click again to clear the filter' : 'Click someone to filter the dashboard'} />
      <CardBody className="px-2 sm:px-3">
        {people.length === 0 ? (
          <EmptyState icon={Users} title="No contributors yet">No commits or pull requests in this period.</EmptyState>
        ) : (
          <ul className="space-y-0.5">
            {people.map((p) => (
              <ContributorRow
                key={p.login} person={p} max={max} total={summary.totals.commits} wide={wide}
                selected={who === p.login} onSelect={() => onSelect(who === p.login ? null : p.login)}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
