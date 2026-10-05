import { Accessibility, Clock, Command, Globe2, Moon, RefreshCw } from 'lucide-react';
import { Reveal } from './Reveal.jsx';
import { SectionHead } from './SectionHead.jsx';
import { BrowserFrame } from './BrowserFrame.jsx';
import { ScrollShot } from './ScrollShot.jsx';
import { Heatmap } from '../charts/Heatmap.jsx';
import { Punchcard } from '../charts/Punchcard.jsx';
import { SignalsCard } from '../dashboard/SignalsCard.jsx';
import { SAMPLE_DAILY, SAMPLE_PUNCHCARD, SAMPLE_SUMMARY, SAMPLE_VALUES, shot } from './sample.js';
import { useTheme } from '../../lib/theme.js';

function Row({ eyebrow, title, children, visual, flip = false }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal variant={flip ? 'right' : 'left'} className={flip ? 'lg:order-2' : undefined}>
        <p className="eyebrow">{eyebrow}</p>
        <h3 className="feature-title mt-3 text-2xl leading-[1.15] sm:text-[32px]">{title}</h3>
        <div className="lede mt-4 space-y-3 text-[16px] leading-[1.6] text-fg-muted">{children}</div>
      </Reveal>
      <Reveal variant="scale" delay={120} className={flip ? 'lg:order-1' : undefined}>{visual}</Reveal>
    </div>
  );
}

const SMALL = [
  [Clock, 'Time-zone aware', 'Days and hours follow your clock, so a 23:30 commit lands on the day you remember.'],
  [RefreshCw, 'Fast to refresh', 'After the first sync, refresh only asks GitHub what changed since last time.'],
  [Command, 'Keyboard first', 'Press Ctrl/Cmd+K to jump between repositories, pages and actions without the mouse.'],
  [Moon, 'Light, dark or system', 'Both themes are designed, not inverted, and your choice is remembered before first paint.'],
  [Accessibility, 'Accessible by default', 'Checked against WCAG 2.1 AA on every page, in both themes, on every release.'],
  [Globe2, 'Honest about limits', 'If GitHub\'s pagination hides part of a range, DevPulse says so instead of guessing.'],
];

export function Features() {
  const { resolved } = useTheme();
  return (
    <section id="features" className="mx-auto max-w-[1120px] px-5 py-20 sm:px-6 sm:py-28" aria-labelledby="features-title">
      <SectionHead id="features-title" eyebrow="Features" title="Everything your team does on GitHub, finally in one place.">
        Stop clicking through Insights tabs. DevPulse brings repositories, pull requests and people together, then shows what the numbers mean.
      </SectionHead>

      <div className="mt-20 space-y-28">
        <Row
          eyebrow="What GitHub does not show"
          title="Find where pull requests wait."
          visual={(
            <BrowserFrame url="devpulse.app/dashboard/reviews">
              <ScrollShot src={shot('reviews', resolved)} alt="The Reviews page: median time to first review, pull requests waiting longest, reviewer load and pull request size." className="aspect-[16/11]" zoom={1.75} />
            </BrowserFrame>
          )}
        >
          <p>Time to first review, the open pull requests nobody has looked at yet, and whether two people are doing all the reviewing.</p>
          <p>Drafts, bots and self-reviews are left out, so the number reflects how long a teammate really waited.</p>
        </Row>

        <Row
          flip
          eyebrow="Across repositories"
          title="One view for the whole team."
          visual={(
            <BrowserFrame url="devpulse.app/dashboard/team">
              <ScrollShot src={shot('team', resolved)} alt="The Team page: combined totals and a table comparing repositories." className="aspect-[16/11]" zoom={1.75} />
            </BrowserFrame>
          )}
        >
          <p>Pick up to fifteen repositories and read them as one: combined totals, a sortable comparison, and a single list of what is waiting.</p>
          <p>Team numbers are computed over all the data together, so they always add up to the parts.</p>
        </Row>

        <Row
          eyebrow="Weekly digest"
          title="The Monday summary writes itself."
          visual={(
            <BrowserFrame url="devpulse.app/dashboard/digest">
              <ScrollShot src={shot('digest', resolved)} alt="The Digest page: delivery settings and a preview of the weekly e-mail." className="aspect-[16/11]" zoom={1.75} />
            </BrowserFrame>
          )}
        >
          <p>Send the week to a Slack channel or your inbox: what shipped, what is stuck, and who carried the reviews.</p>
          <p>Preview the e-mail and the Slack message first. Your webhook is stored encrypted and is never shown again.</p>
        </Row>

        <Row
          flip
          eyebrow="Every repository"
          title="A portfolio view that shows where the energy is."
          visual={(
            <BrowserFrame url="devpulse.app/dashboard/repositories">
              <ScrollShot src={shot('repositories', resolved)} alt="The Repositories page: a grid of repositories with 30-day activity sparklines and open pull request counts." className="aspect-[16/11]" zoom={1.75} />
            </BrowserFrame>
          )}
        >
          <p>See every repository you can access, with a 30-day activity line and open pull requests for the ones you have analyzed.</p>
          <p>Search, sort by recent or most active, and open any repository to go deep, all without leaving the page.</p>
        </Row>

        <Row
          eyebrow="Charts you can interrogate"
          title="See when work really happens."
          visual={(
            <div className="space-y-3" aria-label="Interactive sample charts">
              <Heatmap daily={SAMPLE_DAILY} values={SAMPLE_VALUES} title="Contribution calendar" motionKey="landing-heatmap" />
              <Punchcard matrix={SAMPLE_PUNCHCARD} motionKey="landing-punchcard" />
              <p className="px-1 text-center text-xs text-fg-faint">Live sample data. Hover the charts.</p>
            </div>
          )}
        >
          <p>A contribution calendar, a weekday-by-hour punchcard in your own time zone, and an activity chart that compares with the previous period.</p>
          <p>Hover anything. Every chart answers the follow-up question: which day, who, and how does that compare?</p>
        </Row>

        <Row
          flip
          eyebrow="Plain-English signals"
          title="Health checks you do not have to decode."
          visual={<SignalsCard summary={SAMPLE_SUMMARY} />}
        >
          <p>Review speed, stale pull requests, knowledge spread, work rhythm and momentum, each rated and explained in a sentence.</p>
          <p>No scores to invent and no black box. Every signal is computed from numbers you can see on the dashboard.</p>
        </Row>
      </div>

      <div className="mt-28 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SMALL.map(([Icon, title, text], i) => (
          <Reveal key={title} delay={(i % 3) * 80} className="card lift p-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={17} aria-hidden="true" /></span>
            <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
