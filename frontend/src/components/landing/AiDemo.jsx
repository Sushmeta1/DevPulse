import { Check, Sparkles } from 'lucide-react';
import { Reveal } from './Reveal.jsx';
import { SectionHead } from './SectionHead.jsx';
import { AI_SAMPLE } from './sample.js';
import { useInView } from '../../lib/useInView.js';

/** Words fade in one after another, as though the report were being written - once, when it scrolls into view. */
function Words({ text, start }) {
  return text.split(' ').map((w, i) => (
    <span key={i} className="ai-word" style={{ '--wd': `${start + i * 38}ms` }}>{w}{' '}</span>
  ));
}

const BULLETS = [
  'Only aggregated metrics are sent to the model, never source code or commit messages.',
  'Gemini or OpenAI when you add a key; a free rule-based report when you do not.',
  'A daily allowance per user keeps API costs predictable.',
];

export function AiDemo() {
  const [ref, inView] = useInView({ threshold: 0.35 });
  const insights = AI_SAMPLE.insights;
  const summaryWords = AI_SAMPLE.summary.split(' ').length;
  const insightsStart = 200 + summaryWords * 38 + 200;
  const suggestionsStart = insightsStart + insights.reduce((n, t) => n + t.split(' ').length, 0) * 38 + 200;

  return (
    <section id="ai" className="mx-auto max-w-[1120px] px-5 py-20 sm:px-6 sm:py-28" aria-labelledby="ai-title">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <SectionHead id="ai-title" eyebrow="AI sprint summaries" title="Your sprint retro, drafted for you.">
            Pick a period and DevPulse turns its metrics into a short report: what happened, what stood out, and what to do next.
          </SectionHead>
          <ul className="mt-8 space-y-3">
            {BULLETS.map((b, i) => (
              <Reveal as="li" key={b} delay={i * 90} variant="left" className="flex gap-3 text-[15px] leading-relaxed">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green-soft text-green"><Check size={12} strokeWidth={3} aria-hidden="true" /></span>
                {b}
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal variant="scale" delay={100}>
          <div ref={ref} data-in={inView} className="card p-5 sm:p-6" role="img" aria-label="Example AI sprint summary">
            <div aria-hidden="true">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={15} className="text-accent" /> AI sprint summary</p>
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-fg-muted">Sample · last 30 days</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed"><Words text={AI_SAMPLE.summary} start={200} /></p>

              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-fg-muted">Productivity insights</h3>
              <ul className="mt-2 space-y-2">
                {insights.map((t, i) => (
                  <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-fg-faint" />
                    <span><Words text={t} start={insightsStart + insights.slice(0, i).reduce((n, x) => n + x.split(' ').length, 0) * 38} /></span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-fg-muted">Suggestions</h3>
              <ul className="mt-2 space-y-2">
                {AI_SAMPLE.suggestions.map((t, i) => (
                  <li key={t} className="flex gap-2.5 text-[13px] leading-relaxed"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-fg-faint" />
                    <span><Words text={t} start={suggestionsStart + AI_SAMPLE.suggestions.slice(0, i).reduce((n, x) => n + x.split(' ').length, 0) * 38} />{i === AI_SAMPLE.suggestions.length - 1 && <span className="ai-caret" />}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
