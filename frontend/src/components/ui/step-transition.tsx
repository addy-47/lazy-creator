import * as React from "react";
import { cn } from "@/lib/utils";

interface StepTransitionProps {
  children: React.ReactNode;
  show: boolean;
  direction?: "up" | "down";
  className?: string;
}

export const StepTransition: React.FC<StepTransitionProps> = ({
  children,
  show,
  direction = "down",
  className,
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (show) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!mounted && !show) return null;

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-in-out transform",
        show
          ? "opacity-100 translate-y-0"
          : cn(
              "opacity-0",
              direction === "up" ? "translate-y-4" : "-translate-y-4"
            ),
        className
      )}
    >
      {children}
    </div>
  );
};
