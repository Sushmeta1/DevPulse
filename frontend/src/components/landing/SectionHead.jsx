import { Reveal } from './Reveal.jsx';
import { cn } from '../../lib/cn.js';

export function SectionHead({ eyebrow, title, children, center = false, className, id }) {
  return (
    <Reveal className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="section-title mt-3">{title}</h2>
      {children && <p className="lede mt-4 text-[17px] leading-[1.6] text-fg-muted">{children}</p>}
    </Reveal>
  );
}
