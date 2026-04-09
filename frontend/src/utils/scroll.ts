/**
 * Performance optimization utilities for scroll and animation handling
 */

/**
 * Throttles a function to limit how often it can be called
 * @param func The function to throttle
 * @param limit The minimum time between function calls in ms
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let lastRan: number = 0;

  return function (this: unknown, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args as unknown[]);
      lastRan = Date.now();
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      if (lastFunc) {
        clearTimeout(lastFunc);
      }
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args as unknown[]);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Adds event listener with passive option for better scroll performance
 * @param element The element to attach the event listener to
 * @param eventName The event name to listen for
 * @param handler The event handler function
 */
export function addPassiveEventListener(
  element: Window | HTMLElement,
  eventName: string,
  handler: EventListenerOrEventListenerObject
): () => void {
  element.addEventListener(eventName, handler, { passive: true });

  return () => {
    element.removeEventListener(eventName, handler);
  };
}

/**
 * Queue a function to run on the next animation frame with fallback
 * @param callback Function to execute on next animation frame
 */
export function rafScroll(callback: () => void): () => void {
  let ticking = false;
  let rafId: number | null = null;

  const scrollHandler = () => {
    if (!ticking) {
      rafId = requestAnimationFrame(() => {
        callback();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener("scroll", scrollHandler, { passive: true });

  return () => {
    window.removeEventListener("scroll", scrollHandler);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
  };
}

/**
 * Debounces a function to ensure it only runs after a certain period of inactivity
 * @param func The function to debounce
 * @param wait The time to wait after last call in ms
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func.apply(this, args as unknown[]);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Get scroll position with cross-browser support
 */
export function getScrollPosition(): { scrollX: number; scrollY: number } {
  return {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

/**
 * Detect if an element is in viewport
 * @param element The element to check
 * @param offset The offset to apply to the calculation
 */
export function isInViewport(element: HTMLElement, offset = 0): boolean {
  const rect = element.getBoundingClientRect();

  return (
    rect.top <=
      (window.innerHeight || document.documentElement.clientHeight) + offset &&
    rect.bottom >= 0 - offset &&
    rect.left <=
      (window.innerWidth || document.documentElement.clientWidth) + offset &&
    rect.right >= 0 - offset
  );
}
