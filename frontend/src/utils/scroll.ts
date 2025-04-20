/**
 * Performance optimization utilities for scroll and animation handling
 */

/**
 * Throttles a function to limit how often it can be called
 * @param func The function to throttle
 * @param limit The minimum time between function calls in ms
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  let lastFunc: ReturnType<typeof setTimeout> | null = null;
  let lastRan: number = 0;

  return function (this: any, ...args: Parameters<T>): void {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      clearTimeout(lastFunc as ReturnType<typeof setTimeout>);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Adds event listener with passive option for better scroll performance
 * @param element The element to attach the event listener to
 * @param eventType The event type to listen for
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
 * Cancel a previously scheduled rafScroll
 * @param id The ID returned by rafScroll
 */
export const cancelRafScroll = (id: number): void => {
  (window.cancelAnimationFrame || window.clearTimeout)(id);
};

/**
 * Debounces a function to ensure it only runs after a certain period of inactivity
 * @param func The function to debounce
 * @param wait The time to wait after last call in ms
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func.apply(this, args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Helper to clean up multiple scroll event listeners
export function cleanupScrollListeners(
  elements: (HTMLElement | Window | null)[]
): void {
  const eventNames = ["scroll", "resize", "touchmove"];

  elements.forEach((element) => {
    if (element) {
      eventNames.forEach((eventName) => {
        // This removes all event listeners of that type
        // In a real app, you'd want to be more specific about which handlers to remove
        const el = element as any;
        if (el.getEventListeners && el.getEventListeners(eventName)) {
          el.getEventListeners(eventName).forEach((listener: any) => {
            element.removeEventListener(eventName, listener.listener);
          });
        }
      });
    }
  });
}

// Get scroll position with cross-browser support
export function getScrollPosition(): { scrollX: number; scrollY: number } {
  return {
    scrollX: window.scrollX || window.pageXOffset,
    scrollY: window.scrollY || window.pageYOffset,
  };
}

// Detect if an element is in viewport
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
