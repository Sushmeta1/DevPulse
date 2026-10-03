import { AlertTriangle, GitMerge, Sparkles } from 'lucide-react';
import { BrowserFrame } from './BrowserFrame.jsx';
import { CtaButtons } from './CtaButtons.jsx';
import { useParallax } from './useParallax.js';
import { SAMPLE_SPARK, shot } from './sample.js';
import { Sparkline } from '../charts/Sparkline.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { useAuth } from '../../state/auth.jsx';
import { useMediaQuery, usePrefersReducedMotion } from '../../lib/hooks.js';
import { useTheme } from '../../lib/theme.js';
import { cn } from '../../lib/cn.js';

const ERRORS = {
  invalid_oauth_state: 'Your sign-in session expired. Please try again.',
  github_login_failed: 'GitHub sign-in failed. Please try again.',
  oauth_not_configured: 'GitHub sign-in is not configured on this server yet. You can still explore the live demo.',
};

/**
 * One floating card. Three nested elements so three different transforms never fight:
 * outer = pointer parallax (JS), middle = entrance, inner = idle float (CSS).
 */
function Chip({ className, depth, index, float = {}, layer, children }) {
  return (
    <div ref={layer(depth)} className={cn('pointer-events-none absolute', className)} aria-hidden="true">
      <div className="rise" style={{ '--i': index }}>
        <div className="float" style={{ '--fy': `${float.y ?? -10}px`, '--fd': `${float.d ?? 7}s`, '--fdelay': `${float.delay ?? 0}s`, '--r0': `${float.r0 ?? 0}deg`, '--r1': `${float.r1 ?? 0.6}deg` }}>
          <div className="chip">{children}</div>
        </div>
      </div>
    </div>
  );
}

const HEAT = [0, 1, 0, 2, 3, 1, 0, 1, 2, 4, 3, 2, 1, 0, 2, 3, 4, 4, 3, 1, 1, 3, 4, 2, 3, 2, 0, 0, 2, 3, 1, 4, 3, 2, 1];

export function Hero() {
  const { resolved } = useTheme();
  const { config } = useAuth();
  const reduce = usePrefersReducedMotion();
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const { stage, layer, tilt } = useParallax(!reduce && finePointer);
  const code = new URLSearchParams(window.location.search).get('error');

  return (
    <section className="relative overflow-x-clip pb-10 pt-10 sm:pt-14" aria-labelledby="hero-title">
      <div className="aurora" aria-hidden="true"><span /><span /><span /></div>

      <div className="relative mx-auto max-w-[1120px] px-5 text-center sm:px-6">
        <h1 id="hero-title" className="display mx-auto max-w-[13ch] sm:max-w-[15ch]">
          <span className="hero-line" style={{ '--i': 0 }}>Know how your team</span>
          <span className="hero-line text-fg-muted" style={{ '--i': 1 }}>actually ships.</span>
        </h1>

        <p className="lede rise mx-auto mt-6 max-w-[34rem] text-[17px] leading-[1.55] text-fg-muted sm:text-lg" style={{ '--i': 4 }}>
          See what your team shipped, where reviews stall and who is carrying what. Then let DevPulse write the sprint summary.
        </p>

        {code && (
          <p role="alert" className="fade-in mx-auto mt-6 max-w-lg rounded-lg bg-red-soft px-4 py-3 text-[13px] text-red">{ERRORS[code] || 'Something went wrong while signing in.'}</p>
        )}

        <div className="rise mt-8" style={{ '--i': 5 }}>
          <CtaButtons center />
          <p className="mt-4 text-[13px] text-fg-faint">
            {config?.githubLogin
              ? 'The demo needs no sign-up and runs on generated data.'
              : 'GitHub sign-in is not set up on this server. The demo runs on generated data, no sign-up needed.'}
          </p>
        </div>
      </div>

      {/* The stage: real screenshot in the middle, product "moments" floating around it. */}
      <div ref={stage} className="relative mx-auto mt-10 w-full max-w-[1120px] px-4 sm:px-10 [perspective:1800px]">
        <div ref={tilt(2.2)} className="[transform-style:preserve-3d] [transition:transform_0ms]">
          <div className="rise" style={{ '--i': 7 }}>
            <BrowserFrame bodyClassName="hero-frame-body">
              <img
                src={shot('hero', resolved)} width="1920" height="1200" fetchPriority="high" decoding="async"
                alt="The DevPulse overview dashboard: commit, pull request, contributor and time-to-merge cards above an activity chart and team health signals."
                className="block w-full"
              />
            </BrowserFrame>
          </div>
        </div>

        <Chip layer={layer} depth={34} index={9} className="hidden w-[236px] lg:left-[37%] lg:top-[19%] lg:block" float={{ y: -12, d: 7.5, r1: -0.8 }}>
          <div className="p-3.5">
            <div className="flex items-center justify-between text-[11px] text-fg-muted"><span>Commits · 30 days</span><span className="num rounded-full bg-green-soft px-1.5 text-green">↗ 18%</span></div>
            <p className="num mt-1 text-2xl font-semibold tracking-tight">1,284</p>
            <div className="mt-2 h-9"><Sparkline values={SAMPLE_SPARK} height={36} animate /></div>
          </div>
        </Chip>

        <Chip layer={layer} depth={26} index={10} className="-right-1 top-[12%] hidden w-[270px] sm:block sm:-right-3" float={{ y: -9, d: 8.5, delay: 0.8, r1: 0.7 }}>
          <div className="flex items-start gap-3 p-3.5">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-soft text-violet"><GitMerge size={14} /></span>
            <div className="min-w-0 text-left">
              <p className="text-[11px] text-fg-muted">Merged <span className="num">#482</span></p>
              <p className="truncate text-[13px] font-medium">fix(auth): handle expired sessions</p>
              <p className="mt-0.5 text-[11px] text-fg-muted">maya-chen · 14h to merge</p>
            </div>
          </div>
        </Chip>

        <Chip layer={layer} depth={20} index={11} className="-left-3 top-[46%] hidden w-[176px] lg:block" float={{ y: -8, d: 9, delay: 1.6, r1: 0.5 }}>
          <div className="p-3.5">
            <p className="text-[11px] text-fg-muted">26 active days</p>
            <div className="mt-2 grid grid-cols-7 gap-[3px]">{HEAT.map((l, i) => <span key={i} className="heat aspect-square rounded-[3px]" data-level={l} />)}</div>
          </div>
        </Chip>

        <Chip layer={layer} depth={30} index={12} className="-right-4 top-[47%] hidden w-[222px] lg:block" float={{ y: -11, d: 6.8, delay: 0.4, r1: -0.6 }}>
          <div className="flex items-center gap-3 p-3.5 text-left">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-soft text-amber"><AlertTriangle size={14} /></span>
            <div><p className="text-[13px] font-medium">2 stale pull requests</p><p className="text-[11px] text-fg-muted">Open for more than 14 days</p></div>
          </div>
        </Chip>

        <Chip layer={layer} depth={42} index={13} className="bottom-[2%] left-1 hidden sm:block sm:left-[5%]" float={{ y: -10, d: 8, delay: 2.1, r1: 0.5 }}>
          <div className="flex items-center gap-3 p-3">
            <div className="flex -space-x-2">
              {['Maya Chen', 'Tomás Ruiz', 'Priya Raman', 'Kenji Watanabe'].map((n) => (
                <span key={n} className="rounded-full ring-2 ring-[var(--surface)]"><Avatar name={n} src="" size={26} /></span>
              ))}
            </div>
            <p className="text-left text-[12px] font-medium">6 contributors<br /><span className="font-normal text-fg-muted">active this week</span></p>
          </div>
        </Chip>

        <Chip layer={layer} depth={22} index={14} className="-bottom-4 right-2 w-[64vw] max-w-[290px] sm:right-[3%]" float={{ y: -9, d: 7.2, delay: 1.2, r1: -0.5 }}>
          <div className="p-3.5 text-left">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-accent"><Sparkles size={12} /> AI sprint summary</p>
            <p className="mt-1.5 text-[12.5px] leading-snug">Review turnaround improved <span className="font-semibold">34%</span>. Median time to merge is now <span className="font-semibold">12h</span>.</p>
          </div>
        </Chip>
      </div>
    </section>
  );
}
