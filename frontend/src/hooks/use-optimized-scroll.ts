import { useEffect, useRef, useState, useCallback } from "react";
import { throttle, debounce, createRAFScrollHandler } from "@/utils/scroll";

interface ScrollOptions {
  throttleTime?: number;
  debounceTime?: number;
  useRAF?: boolean;
  passive?: boolean;
}

interface ScrollState {
  scrollX: number;
  scrollY: number;
  direction: "up" | "down" | "none";
  atTop: boolean;
  atBottom: boolean;
}

/**
 * Hook for optimized scroll event handling
 *
 * @param callback Optional callback function to execute on scroll
 * @param options Configuration options
 * @returns Scroll state object with current position and direction
 */
export function useOptimizedScroll(
  callback?: (state: ScrollState) => void,
  options: ScrollOptions = {}
) {
  const {
    throttleTime = 100,
    debounceTime = 300,
    useRAF = true,
    passive = true,
  } = options;

  const [scrollState, setScrollState] = useState<ScrollState>({
    scrollX: typeof window !== "undefined" ? window.scrollX : 0,
    scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    direction: "none",
    atTop: typeof window !== "undefined" ? window.scrollY <= 0 : true,
    atBottom:
      typeof window !== "undefined"
        ? window.scrollY + window.innerHeight >= document.body.scrollHeight
        : false,
  });

  const prevScrollY = useRef<number>(
    typeof window !== "undefined" ? window.scrollY : 0
  );
  const scrollListenerRef = useRef<() => void | null>(null);

  // Create the scroll handler function
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const currentScrollX = window.scrollX;
    const direction: "up" | "down" | "none" =
      currentScrollY > prevScrollY.current
        ? "down"
        : currentScrollY < prevScrollY.current
        ? "up"
        : "none";

    const atTop = currentScrollY <= 0;
    const atBottom =
      currentScrollY + window.innerHeight >= document.body.scrollHeight - 10;

    const newState: ScrollState = {
      scrollY: currentScrollY,
      scrollX: currentScrollX,
      direction,
      atTop,
      atBottom,
    };

    setScrollState(newState);
    if (callback) callback(newState);
    prevScrollY.current = currentScrollY;
  }, [callback]);

  // Apply appropriate optimization method
  useEffect(() => {
    if (typeof window === "undefined") return;

    let optimizedScrollHandler;

    if (useRAF) {
      optimizedScrollHandler = createRAFScrollHandler(handleScroll);
    } else {
      optimizedScrollHandler = throttle(handleScroll, throttleTime);
    }

    // Also create a debounced version for when scrolling stops
    const debouncedScrollHandler = debounce(handleScroll, debounceTime);

    // Combine both handlers to get the benefits of throttling during scroll
    // and a final update when scrolling stops
    const combinedScrollHandler = () => {
      optimizedScrollHandler();
      debouncedScrollHandler();
    };

    window.addEventListener("scroll", combinedScrollHandler, { passive });
    scrollListenerRef.current = () => {
      window.removeEventListener("scroll", combinedScrollHandler);
    };

    // Set initial state
    handleScroll();

    return () => {
      if (scrollListenerRef.current) {
        scrollListenerRef.current();
      }
    };
  }, [handleScroll, throttleTime, debounceTime, useRAF, passive]);

  return scrollState;
}

export default useOptimizedScroll;
