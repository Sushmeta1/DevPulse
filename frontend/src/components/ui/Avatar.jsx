import { useState } from 'react';
import { cn } from '../../lib/cn.js';
import { hueFor, initials } from '../../lib/format.js';

/**
 * Real GitHub avatar when we have a login, initials on a stable colour otherwise - and again if the
 * image 404s or never arrives, so the slot is never a broken-image icon and never changes size.
 */
export function Avatar({ login, name, src, size = 24, className }) {
  const [failed, setFailed] = useState(false);
  const label = name || login || '?';
  const url = src || (login && /^[A-Za-z0-9-]+$/.test(login) ? `https://github.com/${login}.png?size=${size * 2}` : null);
  const hue = hueFor(login || label);

  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white', className)}
      style={{
        width: size, height: size, fontSize: Math.max(9, size * 0.4),
        background: `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 40) % 360} 70% 42%))`,
      }}
      aria-hidden="true"
    >
      {initials(label)}
      {url && !failed && (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      )}
    </span>
  );
}
