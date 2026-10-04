import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Logo } from '../ui/Logo.jsx';
import { Button } from '../ui/Button.jsx';
import { ThemeToggle } from '../layout/ThemeToggle.jsx';
import { useStartDemo } from './CtaButtons.jsx';
import { useAuth } from '../../state/auth.jsx';
import { api } from '../../services/api.js';
import { cn } from '../../lib/cn.js';

const LINKS = [['Features', '#features'], ['Product tour', '#tour'], ['AI summaries', '#ai'], ['How it works', '#how'], ['FAQ', '#faq']];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { config } = useAuth();
  const { starting, start } = useStartDemo();

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 8));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow] duration-200',
        scrolled ? 'bg-bg/80 backdrop-blur-md hairline-b' : 'bg-transparent',
      )}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-4 px-5 sm:px-6">
        <Logo to="/" />
        <nav aria-label="Page sections" className="ml-6 hidden items-center gap-1 lg:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="press rounded-md px-3 py-1.5 text-[13px] text-fg-muted transition-colors duration-150 hover:text-fg">{label}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {config?.githubLogin && (
            <a href={api.loginUrl} className="press hidden h-8 items-center rounded-lg px-3 text-[13px] font-medium text-fg-muted hover:text-fg sm:inline-flex">Sign in</a>
          )}
          {config?.demo && (
            <Button variant="primary" size="md" loading={starting} onClick={start}>
              Live demo <ArrowRight size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
