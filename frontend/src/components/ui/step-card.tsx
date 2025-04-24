import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";
import { FocusTrap } from "./focus-trap";

interface StepCardProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  title: string;
  description?: string;
  isActive: boolean;
  isCompleted: boolean;
  className?: string;
  children: React.ReactNode;
}

export const StepCard = React.forwardRef<HTMLDivElement, StepCardProps>(
  (
    {
      step,
      title,
      description,
      isActive,
      isCompleted,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-card-ruby step-card relative",
          isActive
            ? "step-card-active ring-2 ring-[#E0115F] ring-opacity-50"
            : "step-card-inactive",
          isCompleted && !isActive ? "step-card-completed" : "",
          isCompleted && !isActive ? "step-completed-glow" : "",
          className
        )}
        style={{
          ...(isCompleted && !isActive ? { 
            boxShadow: "0 8px 16px -3px rgba(224, 17, 95, 0.25)"
          } : {})
        }}
        role="region"
        aria-label={`Step ${step}: ${title}`}
        aria-current={isActive ? "step" : undefined}
        {...props}
      >
        {isCompleted && !isActive && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#E0115F] rounded-full flex items-center justify-center shadow-md transform translate-x-1 -translate-y-1 z-10">
            <CheckCircle size={12} className="text-white" />
          </div>
        )}
        
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <h3 className="text-xl font-medium">{title}</h3>
                {isCompleted && !isActive && (
                  <span className="ml-3 text-[#E0115F] animate-pulse">
                    <CheckCircle size={20} />
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {isCompleted && !isActive && (
              <div className="bg-[#E0115F]/10 text-[#E0115F] px-2 py-1 rounded text-xs font-semibold">
                Completed
              </div>
            )}
          </div>
          {isActive ? (
            <FocusTrap active={isActive}>
              <div>{children}</div>
            </FocusTrap>
          ) : (
            <div>{children}</div>
          )}
        </div>
      </div>
    );
  }
);
