import * as React from "react";
import { cn } from "@/lib/utils";
import { FocusTrap } from "./focus-trap";

interface StepCardProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number;
  title: string;
  description?: string;
  isActive?: boolean;
  isCompleted?: boolean;
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
          "glass-card-ruby step-card",
          isActive
            ? "step-card-active ring-2 ring-[#E0115F] ring-opacity-50"
            : "step-card-inactive",
          isCompleted && "step-card-completed",
          className
        )}
        role="region"
        aria-label={`Step ${step}: ${title}`}
        aria-current={isActive ? "step" : undefined}
        {...props}
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold",
                isCompleted
                  ? "bg-[#E0115F] text-white"
                  : "bg-[#E0115F]/10 text-[#E0115F]",
                isActive &&
                  !isCompleted &&
                  "ring-2 ring-[#E0115F] ring-opacity-50"
              )}
            >
              {isCompleted ? "✓" : step}
            </div>
            <div>
              <h3 className="text-xl font-medium mb-1">{title}</h3>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
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
