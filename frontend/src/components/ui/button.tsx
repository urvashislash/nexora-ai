import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'bronze';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-sans text-xs font-semibold tracking-tight transition-all duration-150 ease-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400/50 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]';

    const variants = {
      default: 'bg-[#18181B] text-white hover:bg-[#27272A] shadow-xs active:bg-[#09090B]',
      destructive: 'bg-[#FF3B30] text-white hover:bg-[#E02E24] shadow-xs',
      outline: 'border border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300 shadow-2xs',
      secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200/80',
      ghost: 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
      link: 'text-[#C38B4B] underline-offset-4 hover:underline p-0 h-auto font-medium',
      bronze: 'bg-[#C38B4B] text-white font-semibold hover:bg-[#B07A3E] shadow-xs',
    };

    const sizes = {
      default: 'h-9 px-4 py-2 text-xs',
      sm: 'h-7 rounded-md px-2.5 text-[11px]',
      lg: 'h-10 rounded-xl px-6 text-sm',
      icon: 'h-8 w-8 rounded-lg',
    };

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="mr-2 h-3.5 w-3.5 animate-spin text-current" viewBox="0 0 24 24">
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
