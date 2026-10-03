import { Logo } from '../ui/Logo.jsx';

export function Footer() {
  return (
    <footer className="border-t border-[var(--ring)]">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Logo to="/" />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-fg-muted">AI-powered GitHub activity dashboard. A minor project at UPES.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-fg-muted">
          <a className="hover:text-fg" href="#features">Features</a>
          <a className="hover:text-fg" href="#tour">Product tour</a>
          <a className="hover:text-fg" href="#faq">FAQ</a>
          <a className="hover:text-fg" href="https://github.com/Sushmeta1/DevPulse" target="_blank" rel="noreferrer">Source on GitHub</a>
        </nav>
      </div>
    </footer>
  );
}
