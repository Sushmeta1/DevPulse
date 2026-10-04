import { useEffect, useState } from 'react';
import { Reveal } from './Reveal.jsx';
import { SectionHead } from './SectionHead.jsx';
import { BrowserFrame } from './BrowserFrame.jsx';
import { ScrollShot } from './ScrollShot.jsx';
import { Segmented } from '../ui/Segmented.jsx';
import { shot } from './sample.js';
import { useInView } from '../../lib/useInView.js';
import { useTheme } from '../../lib/theme.js';

const TABS = {
  overview: {
    label: 'Overview', url: 'devpulse.app/dashboard',
    title: 'The whole picture, one scroll',
    text: 'KPI cards with period-over-period change, an interactive activity chart, a contribution calendar, a weekday-by-hour punchcard, pull request outcomes and a time-to-merge histogram.',
    alt: 'The full Overview page, scrolling from KPI cards through the activity chart, calendar, punchcard, pull request charts, contributors and the AI summary.',
  },
  repositories: {
    label: 'Repositories', url: 'devpulse.app/dashboard/repositories',
    title: 'Every repository at a glance',
    text: 'Totals across everything you have analyzed, plus a sparkline and open pull request count per repository. Search and sort to find the busy ones.',
    alt: 'The Repositories page with totals across analyzed repositories and a card grid.',
  },
  pulls: {
    label: 'Pull requests', url: 'devpulse.app/dashboard/pulls',
    title: 'Find what is stuck',
    text: 'Filter by state, search by title or author, and spot stale pull requests and slow merges before they slow the team down.',
    alt: 'The Pull requests page with state filters, a searchable list and a time-to-merge chart.',
  },
  people: {
    label: 'Contributors', url: 'devpulse.app/dashboard/people',
    title: 'See who is carrying what',
    text: 'Per-person commits, pull requests and activity. Select someone to filter the whole dashboard to their work.',
    alt: 'The Contributors page with a leaderboard and one person selected.',
  },
  insights: {
    label: 'Insights', url: 'devpulse.app/dashboard/insights',
    title: 'Summaries you can paste into a standup',
    text: 'Health signals and an AI-written sprint report with insights and suggestions. Copy it as Markdown in one click.',
    alt: 'The Insights page with a generated sprint summary and team health signals.',
  },
};

export function ProductTour() {
  const { resolved } = useTheme();
  const [tab, setTab] = useState('overview');
  const [ref, inView] = useInView({ threshold: 0.15 });
  const current = TABS[tab];

  // Warm the other screenshots once the section is on screen so switching tabs is instant.
  useEffect(() => {
    if (!inView) return;
    Object.keys(TABS).forEach((name) => { new Image().src = shot(name, resolved); });
  }, [inView, resolved]);

  return (
    <section id="tour" ref={ref} className="relative border-y border-[var(--ring)] bg-surface-2/50 py-20 sm:py-28" aria-labelledby="tour-title">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <SectionHead id="tour-title" center eyebrow="Product tour" title="Take a look around.">
          These are real screenshots of the built-in demo workspace. The page scrolls itself; hover to pause.
        </SectionHead>

        <Reveal delay={100} className="mt-10 flex justify-center">
          <Segmented label="Product tour page" value={tab} onChange={setTab} options={Object.entries(TABS).map(([value, t]) => ({ value, label: t.label }))} />
        </Reveal>

        <Reveal variant="scale" delay={160} className="mt-8">
          <div key={`${tab}-${resolved}`} className="tour-swap">
            <BrowserFrame url={current.url} className="mx-auto max-w-[1040px]">
              <ScrollShot src={shot(tab, resolved)} alt={current.alt} className="aspect-[16/10]" running={inView} />
            </BrowserFrame>
            <div className="mx-auto mt-8 max-w-xl text-center">
              <h3 className="text-xl font-semibold tracking-tight">{current.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{current.text}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
