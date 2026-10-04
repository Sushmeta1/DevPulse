import { useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Check, ListChecks, Search } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { plural } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';

export const MAX_TEAM_REPOS = 15;

/** Choose which repositories make up the team view. Selection is applied on "Apply" so the page does not refetch per click. */
export function RepoPicker({ repos, selected, onApply }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return repos.filter((r) => !q || r.fullName.toLowerCase().includes(q));
  }, [repos, query]);

  const toggle = (name) => setDraft((d) => (d.includes(name) ? d.filter((n) => n !== name) : d.length < MAX_TEAM_REPOS ? [...d, name] : d));
  const atLimit = draft.length >= MAX_TEAM_REPOS;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) { setDraft(selected); setQuery(''); } }}
    >
      <Dialog.Trigger render={<Button icon={ListChecks}>Choose repositories</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop fixed inset-0 z-50" />
        <Dialog.Popup className="modal modal-sm z-50 flex max-h-[70vh] flex-col p-0" style={{ top: '12vh' }}>
          <div className="px-5 pt-5">
            <Dialog.Title className="text-base font-semibold tracking-tight">Repositories in this view</Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-fg-muted">
              Pick up to {MAX_TEAM_REPOS}. Repositories you have not opened before are analyzed the first time (a few at a time).
            </Dialog.Description>
            <label className="relative mt-3 block">
              <span className="sr-only">Filter repositories</span>
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
              <input
                type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter repositories"
                className="h-8 w-full rounded-lg bg-surface pl-8 pr-2.5 text-[13px] shadow-[0_0_0_1px_var(--ring)] outline-none placeholder:text-fg-faint focus:shadow-[0_0_0_2px_var(--accent)]"
              />
            </label>
          </div>
          <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-2" aria-label="Repositories">
            {rows.map((r) => {
              const on = draft.includes(r.fullName);
              const disabled = !on && atLimit;
              return (
                <li key={r.fullName}>
                  <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-surface-2', disabled && 'cursor-not-allowed opacity-50')}>
                    <input type="checkbox" className="peer sr-only" checked={on} disabled={disabled} onChange={() => toggle(r.fullName)} />
                    <span
                      aria-hidden="true"
                      className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border border-[var(--ring-strong)] text-[var(--accent-fg)] transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)]', on && 'border-accent bg-accent')}
                    >
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate"><span className="text-fg-muted">{r.owner}/</span><span className="font-medium">{r.name}</span></span>
                    {!r.synced && <span className="shrink-0 text-xs text-fg-faint">new</span>}
                  </label>
                </li>
              );
            })}
            {rows.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-fg-muted">No matching repositories.</li>}
          </ul>
          <div className="hairline-t flex items-center justify-between gap-3 px-5 py-3">
            <span className="num text-xs text-fg-muted" role="status">{plural(draft.length, 'repository', 'repositories')} selected</span>
            <div className="flex gap-2">
              <Dialog.Close render={<Button>Cancel</Button>} />
              <Button variant="primary" disabled={draft.length === 0} onClick={() => { onApply(draft); setOpen(false); }}>Apply</Button>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
