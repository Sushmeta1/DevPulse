import { Github as GithubIcon } from '../ui/GithubIcon.jsx';
import { BarChart3, Database, Sparkles } from 'lucide-react';
import { Reveal } from './Reveal.jsx';
import { SectionHead } from './SectionHead.jsx';
import { useInView } from '../../lib/useInView.js';

const STEPS = [
  [GithubIcon, 'Connect GitHub', 'Sign in with GitHub OAuth. DevPulse reads metadata through your own token, so it can only see what you can see.'],
  [Database, 'We sync and analyze', 'Commits and pull requests are stored in PostgreSQL. After the first sync, only what changed is fetched.'],
  [BarChart3, 'Explore the dashboard', 'Charts, health signals and contributor stats update for any repository and any time range.'],
  [Sparkles, 'Generate the summary', 'One click turns the numbers into a written sprint report you can copy straight into your standup notes.'],
];

export function HowItWorks() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  return (
    <section id="how" className="mx-auto max-w-[1120px] px-5 py-20 sm:px-6 sm:py-28" aria-labelledby="how-title">
      <SectionHead id="how-title" center eyebrow="How it works" title="From sign-in to insight in about a minute." />
      <ol ref={ref} data-in={inView} className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-[var(--ring)] lg:block" aria-hidden="true">
          <div className="connector h-px w-full bg-accent" />
        </div>
        {STEPS.map(([Icon, title, text], i) => (
          <li key={title} className="relative text-center">
            <span className="step-dot relative z-10 mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-fg shadow-[0_0_0_1px_var(--ring-strong)]" style={{ '--d': `${300 + i * 260}ms` }}>
              <Icon size={19} aria-hidden="true" />
            </span>
            <Reveal delay={200 + i * 120}>
              <p className="mt-4 text-xs font-medium text-fg-faint">Step {i + 1}</p>
              <h3 className="mt-1 text-[15px] font-semibold tracking-tight">{title}</h3>
              <p className="mx-auto mt-2 max-w-[28ch] text-[13px] leading-relaxed text-fg-muted">{text}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
