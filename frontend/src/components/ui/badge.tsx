import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'bronze' | 'cyan';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base = 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-sans font-medium tracking-tight transition-colors select-none';

  const variants = {
    default: 'bg-slate-900 text-slate-100',
    secondary: 'bg-slate-100 text-slate-700 border border-slate-200/80',
    destructive: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    outline: 'border border-slate-200 text-slate-700 bg-white shadow-2xs',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    bronze: 'bg-amber-50/80 text-[#C38B4B] border border-amber-200/70',
    cyan: 'bg-sky-50 text-sky-700 border border-sky-200/80',
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}
