import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-sans font-semibold tracking-tight transition-colors focus:outline-hidden border select-none",
  {
    variants: {
      variant: {
        default:
          "border-slate-300 bg-slate-900 text-white shadow-2xs",
        secondary:
          "border-slate-200/90 bg-slate-100/80 text-slate-700",
        destructive:
          "border-rose-200/90 bg-rose-50 text-[#FF3B30]",
        success:
          "border-emerald-200/90 bg-emerald-50 text-[#34C759]",
        warning:
          "border-amber-200/90 bg-amber-50 text-[#FF9500]",
        info:
          "border-blue-200/90 bg-blue-50 text-[#007AFF]",
        bronze:
          "border-amber-300/80 bg-amber-50 text-[#C38B4B]",
        cyan:
          "border-sky-200/90 bg-sky-50 text-sky-700",
        outline:
          "border-slate-200/90 bg-transparent text-slate-700",
        neutral:
          "border-slate-200/70 bg-slate-50 text-slate-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
