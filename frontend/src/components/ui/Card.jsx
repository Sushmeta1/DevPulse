import { cn } from '../../lib/cn.js';

export function Card({ className, children, as: Tag = 'section', ...props }) {
  return <Tag className={cn('card min-w-0', className)} {...props}>{children}</Tag>;
}

export function CardHeader({ title, description, actions, className }) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 sm:px-5 sm:pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export const CardBody = ({ className, children }) => <div className={cn('px-4 pb-4 pt-3 sm:px-5 sm:pb-5', className)}>{children}</div>;
