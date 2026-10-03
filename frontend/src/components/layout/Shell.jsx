import { Outlet } from 'react-router-dom';
import { ChevronsUpDown, Lock, Search } from 'lucide-react';
import { TooltipProvider } from '../ui/Tooltip.jsx';
import { Kbd } from '../ui/Kbd.jsx';
import { Button } from '../ui/Button.jsx';
import { CommandProvider, useCommandMenu } from './CommandMenu.jsx';
import { NavTabs } from './NavTabs.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { UserMenu } from './UserMenu.jsx';
import { PageHeader, DashboardGate } from './PageHeader.jsx';
import { Logo } from '../ui/Logo.jsx';
import { useAuth } from '../../state/auth.jsx';
import { useWorkspace } from '../../state/workspace.jsx';

function RepoButton() {
  const { open } = useCommandMenu();
  const { repo, repoMeta } = useWorkspace();
  const [owner, name] = (repo || '').split('/');
  return (
    <button
      onClick={() => open('click')}
      className="press flex h-8 min-w-0 max-w-[46vw] items-center gap-2 rounded-lg px-2 text-[13px] hover:bg-surface-2 sm:max-w-md"
      aria-label={repo ? `Repository: ${repo}. Change repository` : 'Choose a repository'}
    >
      {repo ? (
        <>
          <span className="min-w-0 truncate"><span className="text-fg-muted">{owner}/</span><span className="font-medium">{name}</span></span>
          {repoMeta?.isPrivate && <Lock size={12} className="shrink-0 text-fg-faint" aria-hidden="true" />}
        </>
      ) : <span className="text-fg-muted">Choose repository</span>}
      <ChevronsUpDown size={14} className="shrink-0 text-fg-faint" aria-hidden="true" />
    </button>
  );
}

function SearchButton() {
  const { open } = useCommandMenu();
  return (
    <>
      <button
        onClick={() => open('click')}
        className="press hidden h-8 items-center gap-2 rounded-lg bg-surface-2 pl-2.5 pr-1.5 text-[13px] text-fg-muted shadow-[inset_0_0_0_1px_var(--ring)] hover:text-fg md:flex"
        aria-label="Open command menu"
      >
        <Search size={14} aria-hidden="true" /> Search
        <Kbd className="ml-6">⌘K</Kbd>
      </button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => open('click')} aria-label="Open command menu"><Search size={16} aria-hidden="true" /></Button>
    </>
  );
}

function DemoBanner() {
  const { user, signOut } = useAuth();
  if (!user?.isDemo) return null;
  return (
    <div className="bg-accent-soft text-[13px]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <p><span className="font-medium text-accent">Demo workspace.</span> <span className="text-fg-muted">Generated sample data - nothing here is real, and no GitHub or AI keys are used.</span></p>
        <button onClick={signOut} className="press font-medium text-accent hover:underline">Exit demo</button>
      </div>
    </div>
  );
}

export function Shell() {
  const ws = useWorkspace();
  const openPulls = ws.data?.summary.totals.openPullRequests;

  const items = [
    { to: '/dashboard', label: 'Overview', end: true },
    { to: '/dashboard/pulls', label: 'Pull requests', count: openPulls },
    { to: '/dashboard/people', label: 'Contributors' },
    { to: '/dashboard/insights', label: 'Insights' },
  ];

  return (
    <TooltipProvider>
      <CommandProvider>
        <div className="min-h-dvh">
          <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md hairline-b">
            <div className="mx-auto max-w-[1200px] px-3 sm:px-5">
              <div className="flex h-14 items-center gap-2">
                <Logo />
                <span className="text-fg-faint" aria-hidden="true">/</span>
                <RepoButton />
                <div className="ml-auto flex items-center gap-1.5">
                  <SearchButton />
                  <ThemeToggle />
                  <UserMenu />
                </div>
              </div>
              <NavTabs items={items} />
            </div>
          </header>
          <DemoBanner />
          <main className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-6 sm:px-6">
            <PageHeader />
            <DashboardGate>
              <Outlet />
            </DashboardGate>
          </main>
        </div>
      </CommandProvider>
    </TooltipProvider>
  );
}
