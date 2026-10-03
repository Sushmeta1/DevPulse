import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, GitPullRequest, Sparkles, Activity } from 'lucide-react';
import { Github } from '../components/ui/GithubIcon.jsx';
import { Button } from '../components/ui/Button.jsx';
import { LogoMark } from '../components/ui/Logo.jsx';
import { ThemeToggle } from '../components/layout/ThemeToggle.jsx';
import { Sparkline } from '../components/charts/Sparkline.jsx';
import { api } from '../services/api.js';
import { useAuth } from '../state/auth.jsx';
import { useDocumentTitle } from '../lib/hooks.js';

const ERRORS = {
  invalid_oauth_state: 'Your sign-in session expired. Please try again.',
  github_login_failed: 'GitHub sign-in failed. Please try again.',
  oauth_not_configured: 'GitHub sign-in is not configured on this server yet. You can still explore the demo.',
};

const FEATURES = [
  [Activity, 'Live activity', 'Commits, pull requests and contributors in one place.'],
  [GitPullRequest, 'Review health', 'Time to merge, stale PRs and who is carrying the load.'],
  [Sparkles, 'AI sprint summaries', 'Insights and suggestions written from your real metrics.'],
];

// Decorative only - the card is labelled as sample data.
const SAMPLE = [4, 6, 5, 9, 7, 12, 10, 14, 11, 16, 13, 19, 15, 21];

function Preview() {
  return (
    <div className="card rise relative w-full max-w-md p-5" style={{ '--i': 5 }} aria-hidden="true">
      <div className="flex items-center justify-between text-xs text-fg-muted"><span>acme/web</span><span>Sample data</span></div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="num text-4xl font-semibold tracking-tight">1,284</span>
        <span className="num inline-flex h-5 items-center rounded-full bg-green-soft px-1.5 text-xs font-medium text-green">+18%</span>
      </div>
      <p className="text-xs text-fg-muted">commits in the last 30 days</p>
      <div className="mt-4"><Sparkline values={SAMPLE} height={88} animate /></div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--ring)] pt-4 text-xs">
        {[['Pull requests', '92'], ['Median merge', '14h'], ['Contributors', '6']].map(([k, v]) => (
          <div key={k}><p className="text-fg-muted">{k}</p><p className="num text-base font-semibold">{v}</p></div>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  useDocumentTitle('Sign in');
  const { config, startDemo } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const code = new URLSearchParams(window.location.search).get('error');

  const demo = async () => {
    setStarting(true);
    try {
      await startDemo();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.message);
      setStarting(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <header className="relative mx-auto flex max-w-[1100px] items-center justify-between px-5 py-5">
        <span className="flex items-center gap-2"><LogoMark size={26} /><span className="text-[15px] font-semibold tracking-tight">DevPulse</span></span>
        <ThemeToggle />
      </header>

      <main className="relative mx-auto grid max-w-[1100px] items-center gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div>
          <p className="rise inline-flex h-6 items-center rounded-full bg-surface px-3 text-xs font-medium text-fg-muted shadow-[0_0_0_1px_var(--ring)]" style={{ '--i': 0 }}>
            GitHub analytics, explained by AI
          </p>
          <h1 className="rise mt-5 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl" style={{ '--i': 1 }}>
            Know how your<br />team <span className="text-accent">actually ships.</span>
          </h1>
          <p className="rise mt-5 max-w-lg text-base leading-relaxed text-fg-muted" style={{ '--i': 2 }}>
            DevPulse turns commits and pull requests into a live dashboard, then writes the sprint summary for you.
          </p>

          {code && (
            <p role="alert" className="fade-in mt-6 max-w-lg rounded-lg bg-red-soft px-4 py-3 text-[13px] text-red">{ERRORS[code] || 'Something went wrong while signing in.'}</p>
          )}

          <div className="rise mt-8 flex flex-wrap items-center gap-3" style={{ '--i': 3 }}>
            {config?.githubLogin ? (
              <a href={api.loginUrl} className="press inline-flex h-10 items-center gap-2 rounded-lg bg-fg px-4 text-sm font-medium text-bg hover:opacity-85">
                <Github size={16} /> Continue with GitHub
              </a>
            ) : (
              <Button size="lg" disabled icon={Github}>GitHub sign-in not configured</Button>
            )}
            {config?.demo && (
              <Button size="lg" variant={config?.githubLogin ? 'secondary' : 'primary'} loading={starting} onClick={demo}>
                Explore the live demo <ArrowRight size={15} aria-hidden="true" />
              </Button>
            )}
          </div>

          <ul className="mt-12 grid max-w-xl gap-5 sm:grid-cols-3">
            {FEATURES.map(([Icon, title, text], i) => (
              <li key={title} className="rise" style={{ '--i': 6 + i }}>
                <Icon size={16} className="text-fg-muted" aria-hidden="true" />
                <p className="mt-2 text-[13px] font-medium">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end"><Preview /></div>
      </main>
    </div>
  );
}
