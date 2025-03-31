import React, { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface InfiniteMovingCardsProps {
  items: {
    id: string;
    content: React.ReactNode;
  }[];
  direction?: "left" | "right";
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
  className?: string;
  itemClassName?: string;
}

export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "normal",
  pauseOnHover = true,
  className,
  itemClassName,
}: InfiniteMovingCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [start, setStart] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [loopCreated, setLoopCreated] = useState(false);

  const getSpeed = useCallback(() => {
    switch (speed) {
      case "slow":
        return 40;
      case "fast":
        return 15;
      case "normal":
      default:
        return 25;
    }
  }, [speed]);

  const createLoop = useCallback(() => {
    if (!scrollerRef.current || loopCreated) return;

    // Reset any animation first
    scrollerRef.current.style.animation = "none";
    scrollerRef.current.style.transform = "translateX(0)";

    // Create duplicate set of items for seamless looping
    const scrollerContent = Array.from(scrollerRef.current.children);
    if (scrollerContent.length) {
      const duplicatedItems = scrollerContent.map((item) =>
        item.cloneNode(true)
      );
      duplicatedItems.forEach((item) => {
        if (scrollerRef.current) {
          scrollerRef.current.appendChild(item);
        }
      });
      setLoopCreated(true);
    }
  }, [loopCreated]);

  useEffect(() => {
    if (!scrollerRef.current) return;

    // Set up the loop
    createLoop();

    // Get the computed width of the scroller
    const scrollerWidth = scrollerRef.current.scrollWidth;
    const animationDuration = (scrollerWidth / 50) * (getSpeed() / 25);

    // Apply the animation with dynamically calculated duration
    if (scrollerRef.current && loopCreated) {
      const directionValue = direction === "left" ? "forwards" : "backwards";

      scrollerRef.current.style.animation = `scroll-${direction} ${animationDuration}s linear infinite`;
      scrollerRef.current.style.animationDirection = directionValue;
      scrollerRef.current.style.animationPlayState = start
        ? "running"
        : "paused";

      // Start animation after a short delay to ensure everything is loaded
      setTimeout(() => setStart(true), 100);
    }

    // Create resize observer to handle window size changes
    const resizeObserver = new ResizeObserver(() => {
      if (scrollerRef.current) {
        const newScrollerWidth = scrollerRef.current.scrollWidth;
        const newAnimationDuration =
          (newScrollerWidth / 50) * (getSpeed() / 25);

        scrollerRef.current.style.animation = `scroll-${direction} ${newAnimationDuration}s linear infinite`;
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [direction, getSpeed, start, createLoop, loopCreated]);

  // Handle mouse hover
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover && scrollerRef.current) {
      scrollerRef.current.style.animationPlayState = "paused";
      setIsHovering(true);
    }
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover && scrollerRef.current) {
      scrollerRef.current.style.animationPlayState = "running";
      setIsHovering(false);
    }
  }, [pauseOnHover]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={scrollerRef}
        className={cn(
          "flex min-w-full shrink-0 gap-4 py-4 w-max flex-nowrap",
          start && "animate-scroll",
          isHovering && "animate-paused"
        )}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn("flex-shrink-0 w-auto", itemClassName)}
            style={{ willChange: "transform" }}
          >
            {item.content}
          </div>
        ))}
      </div>
    </div>
  );
}

// Define keyframes for smooth scrolling
export function addScrollKeyframes() {
  if (typeof document !== "undefined") {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes scroll-left {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }

      @keyframes scroll-right {
        from { transform: translateX(-50%); }
        to { transform: translateX(0); }
      }

      .animate-paused {
        animation-play-state: paused !important;
      }
    `;
    document.head.append(style);
  }
}

// Add scroll keyframes when imported
if (typeof document !== "undefined") {
  addScrollKeyframes();
}
