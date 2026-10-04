import { Link } from 'react-router-dom';
import { LogoMark } from '../components/ui/Logo.jsx';
import { useDocumentTitle } from '../lib/hooks.js';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <LogoMark size={36} />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1 text-[13px] text-fg-muted">That page doesn&apos;t exist.</p>
        <Link to="/" className="press mt-5 inline-flex h-8 items-center rounded-lg bg-fg px-3 text-[13px] font-medium text-bg hover:opacity-85">Back to DevPulse</Link>
      </div>
    </div>
  );
}
