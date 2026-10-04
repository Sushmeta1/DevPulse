import { Link } from 'react-router-dom';

export function LogoMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--fg)" />
      <path d="M5 17h5l3-8 5 15 3-9 2 2h4" fill="none" stroke="var(--bg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ to = '/dashboard', className = '' }) {
  return (
    <Link to={to} className={`press flex shrink-0 items-center gap-2 rounded-md ${className}`} aria-label="DevPulse home">
      <LogoMark />
      <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">DevPulse</span>
    </Link>
  );
}
