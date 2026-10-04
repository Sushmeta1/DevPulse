import { Accordion } from '@base-ui/react/accordion';
import { ChevronDown } from 'lucide-react';
import { Reveal } from './Reveal.jsx';
import { SectionHead } from './SectionHead.jsx';

const FAQ = [
  ['Does DevPulse read my code?', 'No. It fetches repository metadata only: commit SHAs, the first line of commit messages, author names, timestamps, and pull request titles, states and dates. Source code is never requested.'],
  ['What access does it ask for?', 'GitHub OAuth with the repo scope so private repositories can be read. If you only want public repositories, the server can be configured with the narrower public_repo scope.'],
  ['Can I try it without connecting GitHub?', 'Yes. The live demo signs you into a shared workspace of generated repositories that runs through the real pipeline. It never calls GitHub or a paid AI service.'],
  ['What does the AI see?', 'Aggregated numbers only: totals, rates, daily counts and top contributors. Never source code and never commit messages. Without an AI key you still get a rule-based summary.'],
  ['How fresh is the data?', 'The first view of a repository syncs up to 180 days of history. After that, refreshes only fetch what changed, and views within two minutes are served from the database.'],
  ['What are the limits?', 'GitHub\'s API caps history at the 1,000 most recent commits per repository. When that affects the range you are viewing, DevPulse shows a notice and withholds period comparisons instead of guessing.'],
  ['Can I delete my data?', 'Yes, from the account menu. It removes your account, stored repository snapshots and AI reports, and revokes DevPulse\'s grant on GitHub.'],
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-20 sm:px-6 sm:py-28" aria-labelledby="faq-title">
      <SectionHead id="faq-title" center eyebrow="FAQ" title="Questions, answered." />
      <Reveal delay={100} className="mt-10">
        <Accordion.Root className="divide-y divide-[var(--ring)] rounded-xl bg-surface shadow-[var(--shadow-card)]">
          {FAQ.map(([q, a]) => (
            <Accordion.Item key={q} value={q}>
              <Accordion.Header>
                <Accordion.Trigger className="press group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium transition-colors duration-150 hover:bg-surface-2 data-[panel-open]:bg-surface-2/60">
                  {q}
                  <ChevronDown size={16} className="faq-chevron shrink-0 text-fg-muted" aria-hidden="true" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className="faq-panel">
                <p className="px-5 pb-5 pt-1 text-[14px] leading-relaxed text-fg-muted">{a}</p>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </Reveal>
    </section>
  );
}
