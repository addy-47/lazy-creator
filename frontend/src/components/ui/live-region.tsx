import * as React from "react";
import { useEffect } from "react";

interface LiveRegionProps {
  message: string;
  assertive?: boolean;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  assertive = false,
}) => {
  useEffect(() => {
    // Force re-announcement even if the message hasn't changed
    const el = document.getElementById("live-region");
    if (el) {
      el.textContent = "";
      // Use requestAnimationFrame to ensure the clear has taken effect
      requestAnimationFrame(() => {
        el.textContent = message;
      });
    }
  }, [message]);

  return (
    <div
      id="live-region"
      className="sr-only"
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {message}
    </div>
  );
};
