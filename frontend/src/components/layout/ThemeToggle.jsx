import { Moon, Sun } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Tooltip } from '../ui/Tooltip.jsx';
import { useTheme } from '../../lib/theme.js';

const icon = 'absolute transition-[opacity,transform,filter] duration-200 ease-[var(--ease-out)]';
const on = 'opacity-100 scale-100 blur-0';
const off = 'opacity-0 scale-50 blur-[2px]'; // never scale(0): the icon always has a visible shape

/** Icons crossfade with a touch of blur so the swap reads as one object changing, not two overlapping. */
export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <Tooltip content={dark ? 'Switch to light' : 'Switch to dark'}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}>
        <span className="relative grid h-4 w-4 place-items-center">
          <Sun size={16} className={`${icon} ${dark ? off : on}`} aria-hidden="true" />
          <Moon size={16} className={`${icon} ${dark ? on : off}`} aria-hidden="true" />
        </span>
      </Button>
    </Tooltip>
  );
}
