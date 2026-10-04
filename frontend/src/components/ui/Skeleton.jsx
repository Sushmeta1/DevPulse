import { cn } from '../../lib/cn.js';

export const Skeleton = ({ className, style }) => <div aria-hidden="true" className={cn('skeleton', className)} style={style} />;
