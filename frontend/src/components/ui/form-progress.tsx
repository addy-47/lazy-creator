import * as React from "react";
import { cn } from "@/lib/utils";
import { KeyboardShortcuts } from "./keyboard-shortcuts";

interface FormProgressProps {
  steps: ReadonlyArray<{ title: string; isCompleted: boolean }>;
  currentStep: number;
  className?: string;
  onStepClick?: (step: number) => void;
}

export const FormProgress = React.forwardRef<HTMLDivElement, FormProgressProps>(
  ({ steps, currentStep, className, onStepClick }, ref) => {
    const progress =
      (steps.filter((s) => s.isCompleted).length / steps.length) * 100;

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        <div className="flex items-center mb-2">
          <div className="flex-1 flex justify-between items-center px-1">
            {steps.map((step, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex flex-col items-center cursor-pointer transition-all",
                  onStepClick ? "hover:scale-105" : ""
                )}
                onClick={() => onStepClick?.(i + 1)}
                role="button"
                tabIndex={0}
                aria-label={`Go to step ${i + 1}: ${step.title}`}
              >
                <div 
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full mb-1 border-2 transition-all",
                    currentStep === i + 1
                      ? "border-[#E0115F] bg-[#E0115F]/10"
                      : "border-muted",
                    step.isCompleted && "border-[#E0115F]"
                  )}
                >
                  <span className={cn(
                    "text-sm font-medium",
                    currentStep === i + 1
                      ? "text-[#E0115F]"
                      : "text-muted-foreground",
                    step.isCompleted && "text-[#E0115F]"
                  )}>
                    {i + 1}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-sm transition-colors",
                    currentStep === i + 1
                      ? "text-[#E0115F] font-medium"
                      : "text-muted-foreground",
                    step.isCompleted && "text-[#E0115F]"
                  )}
                >
                  {step.title}
                </div>
              </div>
            ))}
          </div>
          <KeyboardShortcuts className="ml-2" />
        </div>
        <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }
);

FormProgress.displayName = "FormProgress";
