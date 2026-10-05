import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Command } from 'cmdk';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes, Check, CornerDownLeft, Mail, MessagesSquare, UsersRound, GitPullRequest, LayoutDashboard, Lock, LogOut, RefreshCw, Search, Sparkles, SunMoon, Timer, Users,
} from 'lucide-react';
import { Kbd } from '../ui/Kbd.jsx';
import { useAuth } from '../../state/auth.jsx';
import { RANGES, useWorkspace } from '../../state/workspace.jsx';
import { useTheme } from '../../lib/theme.js';

const CommandContext = createContext({ open: () => {} });
export const useCommandMenu = () => useContext(CommandContext);

const PAGES = [
  { to: '/dashboard/repositories', label: 'All repositories', icon: Boxes },
  { to: '/dashboard/team', label: 'Team (all repositories)', icon: UsersRound },
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/pulls', label: 'Pull requests', icon: GitPullRequest },
  { to: '/dashboard/reviews', label: 'Reviews', icon: MessagesSquare },
  { to: '/dashboard/people', label: 'Contributors', icon: Users },
  { to: '/dashboard/insights', label: 'Insights', icon: Sparkles },
  { to: '/dashboard/digest', label: 'Weekly digest', icon: Mail },
];

export function CommandProvider({ children }) {
  const [state, setState] = useState({ open: false, source: 'click' });
  const open = useCallback((source = 'click') => setState({ open: true, source }), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setState((s) => ({ open: !s.open, source: 'keyboard' }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ open }), [open]);
  return (
    <CommandContext.Provider value={value}>
      {children}
      <CommandDialog open={state.open} instant={state.source === 'keyboard'} onClose={close} onOpenChange={(o) => (o ? open() : close())} />
    </CommandContext.Provider>
  );
}

function CommandDialog({ open, instant, onClose, onOpenChange }) {
  const instantProps = instant ? { 'data-instant-open': '' } : {};

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop fixed inset-0 z-50" {...instantProps} />
        <Dialog.Popup className="modal z-50" aria-label="Command menu" {...instantProps}>
          <Dialog.Title className="sr-only">Command menu</Dialog.Title>
          <CommandBody onClose={onClose} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CommandBody({ onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const ws = useWorkspace();
  const { toggle } = useTheme();
  const [query, setQuery] = useState('');
  const run = (fn) => () => { onClose(); fn(); };
  const goto = (to) => navigate({ pathname: to, search: location.search });
  const repos = ws?.repos.list ?? [];

  return (
    <>
          <Command loop label="Command menu">
            <div className="flex items-center hairline-b pl-4">
              <Search size={16} className="shrink-0 text-fg-faint" aria-hidden="true" />
              <Command.Input value={query} onValueChange={setQuery} placeholder="Search repositories, pages and actions..." autoFocus />
            </div>
            <Command.List>
              <Command.Empty>No results for “{query}”.</Command.Empty>
              {repos.length > 0 && (
                <Command.Group heading="Repositories">
                  {repos.map((r) => (
                    <Command.Item
                      key={r.fullName} value={r.fullName} keywords={[r.language || '', r.description || '']}
                      onSelect={run(() => ws.setRepo(r.fullName))}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-fg-muted">{r.owner}/</span><span className="font-medium">{r.name}</span>
                      </span>
                      {r.isPrivate && <Lock size={12} className="shrink-0 text-fg-faint" aria-label="Private" />}
                      {r.language && <span className="hidden shrink-0 text-xs text-fg-faint sm:inline">{r.language}</span>}
                      {ws.repo === r.fullName && <Check size={14} className="shrink-0 text-accent" aria-label="Current" />}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Go to">
                {PAGES.map(({ to, label, icon: Icon }) => (
                  <Command.Item key={to} value={`go ${label}`} onSelect={run(() => goto(to))}>
                    <Icon size={15} className="text-fg-muted" aria-hidden="true" /> {label}
                  </Command.Item>
                ))}
              </Command.Group>
              {ws && (
                <Command.Group heading="Time range">
                  {RANGES.map((d) => (
                    <Command.Item key={d} value={`range last ${d} days`} onSelect={run(() => ws.setDays(d))}>
                      <Timer size={15} className="text-fg-muted" aria-hidden="true" /> Last {d} days
                      {ws.days === d && <Check size={14} className="ml-auto text-accent" aria-label="Current" />}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Actions">
                {ws && <Command.Item value="refresh sync data" onSelect={run(ws.refresh)}><RefreshCw size={15} className="text-fg-muted" aria-hidden="true" /> Refresh data from GitHub</Command.Item>}
                {ws && <Command.Item value="generate ai sprint summary" onSelect={run(() => { goto('/dashboard/insights'); ws.generate(); })}><Sparkles size={15} className="text-fg-muted" aria-hidden="true" /> Generate AI summary</Command.Item>}
                <Command.Item value="toggle theme dark light" onSelect={run(toggle)}><SunMoon size={15} className="text-fg-muted" aria-hidden="true" /> Toggle theme</Command.Item>
                {user && <Command.Item value="sign out log out" onSelect={run(signOut)}><LogOut size={15} className="text-fg-muted" aria-hidden="true" /> Sign out</Command.Item>}
              </Command.Group>
            </Command.List>
            <div className="hairline-t flex items-center gap-4 px-4 py-2.5 text-xs text-fg-faint">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft size={10} aria-hidden="true" /></Kbd> select</span>
              <span className="ml-auto flex items-center gap-1.5"><Kbd>esc</Kbd> close</span>
            </div>
          </Command>
    </>
  );
}
