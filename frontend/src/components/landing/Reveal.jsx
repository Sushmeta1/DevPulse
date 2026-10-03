import { useInView } from '../../lib/useInView.js';
import { cn } from '../../lib/cn.js';

/**
 * Scroll reveal built on CSS transitions (interruptible, GPU-friendly): opacity + transform only,
 * ease-out, staggered with `delay`. Variants: up | scale | left | right | fade.
 */
export function Reveal({ as: Tag = 'div', variant = 'up', delay = 0, className, children, ...props }) {
  const [ref, inView] = useInView();
  return (
    <Tag ref={ref} data-reveal={variant} data-in={inView} style={{ '--d': `${delay}ms`, ...props.style }} className={cn('reveal', className)} {...props}>
      {children}
    </Tag>
  );
}
