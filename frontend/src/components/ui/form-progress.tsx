import * as React from "react";
import { cn } from "@/lib/utils";
import { KeyboardShortcuts } from "./keyboard-shortcuts";

interface FormProgressProps {
  steps: ReadonlyArray<{ title: string; isCompleted: boolean }>;
  currentStep: number;
  className?: string;
}

export const FormProgress = React.forwardRef<HTMLDivElement, FormProgressProps>(
  ({ steps, currentStep, className }, ref) => {
    const progress =
      (steps.filter((s) => s.isCompleted).length / steps.length) * 100;

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        <div className="flex items-center mb-2">
          <div className="flex-1 flex justify-between items-center px-1">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center">
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
