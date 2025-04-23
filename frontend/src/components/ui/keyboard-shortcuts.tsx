import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Keyboard } from "lucide-react";

export const KeyboardShortcuts = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={ref}
            className={cn(
              "inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground transition-colors",
              className
            )}
            {...props}
          >
            <Keyboard size={18} />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="space-y-2">
          <h4 className="font-medium">Keyboard Shortcuts</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>Next step</span>
              <div className="flex gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded-md">
                  ↓
                </kbd>
                <span className="text-muted-foreground">or</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded-md">
                  j
                </kbd>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Previous step</span>
              <div className="flex gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded-md">
                  ↑
                </kbd>
                <span className="text-muted-foreground">or</span>
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded-md">
                  k
                </kbd>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Go to step</span>
              <div className="flex gap-1">
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded-md">
                  1
                </kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded-md">
                  2
                </kbd>
                <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded-md">
                  3
                </kbd>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
