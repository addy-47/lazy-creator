import { useEffect } from "react";

export const useStepFocus = (
  step: number,
  focusRef: React.RefObject<HTMLElement>
) => {
  useEffect(() => {
    // Small delay to ensure the element is rendered and scrolled into view
    const timer = setTimeout(() => {
      if (focusRef.current && focusRef.current.querySelector) {
        // Try to find the first focusable element
        const focusable = focusRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusable) {
          focusable.focus();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [step]);
};
