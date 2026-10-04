import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Github } from '../ui/GithubIcon.jsx';
import { api } from '../../services/api.js';
import { useAuth } from '../../state/auth.jsx';
import { cn } from '../../lib/cn.js';

export function useStartDemo() {
  const { startDemo } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const start = async () => {
    setStarting(true);
    try {
      await startDemo();
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.message);
      setStarting(false);
    }
  };
  return { starting, start };
}

/** The two ways in: sign in with GitHub (when this deployment has OAuth) and the no-setup demo. */
export function CtaButtons({ size = 'lg', className, center = false }) {
  const { config } = useAuth();
  const { starting, start } = useStartDemo();
  const height = size === 'lg' ? 'h-11 px-5 text-sm' : 'h-9 px-4 text-[13px]';

  return (
    <div className={cn('flex flex-wrap items-center gap-3', center && 'justify-center', className)}>
      {config?.demo && (
        <Button variant="primary" size={size} loading={starting} onClick={start} className={cn(size === 'lg' && 'h-11 px-5 text-sm')}>
          Explore the live demo <ArrowRight size={15} aria-hidden="true" />
        </Button>
      )}
      {config?.githubLogin && (
        <a href={api.loginUrl} className={cn('press inline-flex items-center gap-2 rounded-lg font-medium text-fg-muted transition-colors duration-150 hover:text-fg', height)}>
          <Github size={16} /> Continue with GitHub
        </a>
      )}
    </div>
  );
}
