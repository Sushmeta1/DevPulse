const TECH = ['React', 'Node.js', 'Express', 'PostgreSQL', 'Docker', 'GitHub Actions', 'Railway', 'Tailwind CSS', 'Recharts', 'GitHub OAuth', 'Gemini', 'OpenAI'];

/** Constant motion, so it is linear and pauses when you hover it. The duplicate half is hidden from screen readers. */
export function TechMarquee() {
  return (
    <section aria-label="Built with" className="relative py-10">
      <p className="mb-5 text-center text-xs font-medium uppercase tracking-wider text-fg-faint">Built with</p>
      <div className="marquee overflow-hidden">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={copy === 1}>
              {TECH.map((t) => (
                <li key={t} className="flex items-center gap-2.5 whitespace-nowrap text-[15px] font-medium text-fg-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-fg-faint" aria-hidden="true" />{t}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
