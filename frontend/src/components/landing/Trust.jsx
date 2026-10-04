import { EyeOff, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { Reveal } from './Reveal.jsx';
import { SectionHead } from './SectionHead.jsx';

const ITEMS = [
  [EyeOff, 'Metadata only', 'DevPulse stores commit messages (first line), authors, timestamps and pull request titles and states. It never reads your source code.'],
  [KeyRound, 'Encrypted tokens', 'Your GitHub token is encrypted at rest with AES-256-GCM. Sessions use signed, httpOnly cookies.'],
  [ShieldCheck, 'Least surprise', 'Strict content security policy, input validation, rate limits and hard timeouts on every outbound call.'],
  [Trash2, 'Delete anytime', 'One action removes your account, every stored snapshot and every report, and revokes DevPulse\'s access on GitHub.'],
];

export function Trust() {
  return (
    <section id="trust" className="border-y border-[var(--ring)] bg-surface-2/50 py-20 sm:py-24" aria-labelledby="trust-title">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <SectionHead id="trust-title" eyebrow="Privacy and security" title="Built to be trusted with your GitHub account." />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(([Icon, title, text], i) => (
            <Reveal key={title} delay={i * 90} className="card lift p-5">
              <Icon size={20} className="text-accent" aria-hidden="true" />
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
