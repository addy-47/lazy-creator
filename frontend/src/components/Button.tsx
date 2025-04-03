import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "outline"
    | "ghost"
    | "link"
    | "destructive"
    | "purple"
    | "gradient";
  size?: "sm" | "default" | "lg" | "icon" | "xl";
  isLoading?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 overflow-hidden";

    const variants = {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      outline:
        "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      purple:
        "bg-purple-600 text-white shadow-md shadow-purple-500/20 hover:bg-purple-700 hover:shadow-lg hover:shadow-purple-500/30 active:bg-purple-800",
      gradient:
        "bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-md shadow-purple-600/20 hover:shadow-lg hover:shadow-purple-600/30 active:from-purple-700 active:to-purple-900",
    };

    const sizes = {
      default: "h-10 px-4 py-2 rounded-md",
      sm: "h-9 rounded-md px-3 text-sm",
      lg: "h-11 rounded-md px-8",
      xl: "h-12 rounded-lg px-10 text-lg font-semibold",
      icon: "h-10 w-10 rounded-md",
    };

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          isLoading &&
            "relative text-transparent transition-none hover:text-transparent",
          className
        )}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {/* Shine effect overlay */}
        <span className="absolute inset-0 w-full h-full bg-gradient-to-t from-white/0 via-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin-slow rounded-full border-2 border-purple-400 border-t-transparent" />
          </div>
        )}

        <span className="relative z-10">{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
