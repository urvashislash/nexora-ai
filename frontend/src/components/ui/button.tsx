import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold font-sans tracking-tight transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 cursor-pointer active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-slate-900 text-white shadow-2xs hover:bg-slate-800 border border-slate-900",
        primary:
          "bg-slate-900 text-white shadow-2xs hover:bg-slate-800 border border-slate-900",
        secondary:
          "bg-slate-100 text-slate-900 hover:bg-slate-200/80 border border-slate-200/60 shadow-2xs",
        outline:
          "border border-slate-200/90 bg-white text-slate-800 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        destructive:
          "bg-rose-50 text-[#FF3B30] border border-rose-200 hover:bg-rose-100/80 shadow-2xs",
        success:
          "bg-[#34C759] text-white hover:bg-[#2db34e] shadow-2xs border border-[#2db34e]",
        bronze:
          "bg-[#C38B4B] text-white hover:bg-[#b07d42] shadow-2xs border border-[#b07d42]",
        link:
          "text-slate-900 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 rounded-md px-2.5 text-[11px]",
        lg: "h-9 rounded-xl px-4 text-xs",
        icon: "h-8 w-8 rounded-lg",
        "icon-sm": "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
