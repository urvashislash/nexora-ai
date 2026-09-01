import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'bronze';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-mono text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

    const variants = {
      default: 'bg-slate-900 text-slate-50 hover:bg-slate-800 shadow-xs',
      destructive: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
      outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      link: 'text-[#C38B4B] underline-offset-4 hover:underline p-0 h-auto',
      bronze: 'bg-[#C38B4B] text-slate-950 font-bold hover:bg-[#b07d42] shadow-xs active:scale-[0.98]',
    };

    const sizes = {
      default: 'h-9 px-4 py-2',
      sm: 'h-7 rounded px-2.5 text-[11px]',
      lg: 'h-10 rounded-md px-6 text-sm',
      icon: 'h-8 w-8',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="mr-2 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
