import { GitMerge, Sparkles } from 'lucide-react';
import { Reveal } from './Reveal.jsx';
import { CtaButtons } from './CtaButtons.jsx';
import { Sparkline } from '../charts/Sparkline.jsx';
import { SAMPLE_SPARK } from './sample.js';

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1120px] px-5 pb-24 sm:px-6" aria-labelledby="cta-title">
      <Reveal variant="scale" className="relative isolate overflow-hidden rounded-3xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-frame)] sm:py-20">
        <div className="aurora" aria-hidden="true"><span /><span /><span /></div>
        <div className="float absolute bottom-10 left-6 hidden w-44 sm:block lg:left-10" style={{ '--fy': '-9px', '--fd': '7s', '--r1': '-1deg' }} aria-hidden="true">
          <div className="chip p-3 text-left"><p className="text-[11px] text-fg-muted">Commits · 30 days</p><div className="mt-1 h-8"><Sparkline values={SAMPLE_SPARK} height={32} /></div></div>
        </div>
        <div className="float absolute right-6 top-10 hidden w-56 sm:block lg:right-10" style={{ '--fy': '-11px', '--fd': '8s', '--fdelay': '0.7s', '--r1': '1deg' }} aria-hidden="true">
          <div className="chip flex items-center gap-2.5 p-3 text-left"><span className="grid h-7 w-7 place-items-center rounded-full bg-violet-soft text-violet"><GitMerge size={13} /></span><p className="text-[12px] font-medium">PR #482 merged in 14h</p></div>
        </div>
        <div className="float absolute bottom-8 right-24 hidden w-52 xl:block" style={{ '--fy': '-8px', '--fd': '6.5s', '--fdelay': '1.4s', '--r1': '-0.8deg' }} aria-hidden="true">
          <div className="chip flex items-center gap-2.5 p-3 text-left"><Sparkles size={14} className="shrink-0 text-accent" /><p className="text-[12px] leading-snug">Review speed up <span className="font-semibold">34%</span></p></div>
        </div>
        <div className="relative">
          <h2 id="cta-title" className="display mx-auto max-w-[14ch] !text-[clamp(2.2rem,5.4vw,3.5rem)]">See your team&apos;s pulse in under a minute.</h2>
          <p className="lede mx-auto mt-5 max-w-md text-[17px] text-fg-muted">Open the demo workspace now. Connect GitHub whenever you are ready.</p>
          <CtaButtons center className="mt-8" />
        </div>
      </Reveal>
    </section>
  );
}
