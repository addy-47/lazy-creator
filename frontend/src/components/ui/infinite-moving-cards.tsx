"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface InfiniteMovingCardsProps {
  items: {
    id: string | number;
    content: React.ReactNode;
  }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
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
  const [loopCreated, setLoopCreated] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimeoutRef = useRef<number | null>(null);

  // Make sure we create a loop with just the right amount of items
  // Don't call this effect on every render - only when needed
  const createLoop = useCallback(() => {
    if (!scrollerRef.current || loopCreated) return;

    // Clone the scroller children to create a loop
    const scrollerContent = Array.from(scrollerRef.current.children);
    
    // Check if we have enough content to scroll
    if (scrollerContent.length <= 1) return;

    // Create a buffer of cloned items to ensure seemless scrolling
    const contentToAdd = scrollerContent.map((item) => {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      return clone;
    });

    // Only append clones once to avoid performance issues
    contentToAdd.forEach((item) => {
      scrollerRef.current?.appendChild(item);
    });

    setLoopCreated(true);
  }, [loopCreated]);

  // Function to get speed value
  const getSpeed = useCallback(() => {
    return {
      fast: 40,
      normal: 25,
      slow: 15,
    }[speed] || 25;
  }, [speed]);

  useEffect(() => {
    if (!scrollerRef.current) return;
    
    // Only create the loop once - this is heavy DOM manipulation
    if (!loopCreated) {
      createLoop();
    }

    // Use requestAnimationFrame to batch style changes
    let animationRequest: number;
    
    const setupAnimation = () => {
      if (!scrollerRef.current || !loopCreated) return;
      
      // Calculate dimensions once rather than repeatedly accessing scrollWidth
      const scrollerWidth = scrollerRef.current.scrollWidth;
      const animationDuration = (scrollerWidth / 50) * (getSpeed() / 25);
      
      // Use requestAnimationFrame to batch style changes
      animationRequest = requestAnimationFrame(() => {
        if (scrollerRef.current) {
          const directionValue = direction === "left" ? "forwards" : "backwards";
          
          // Set all styles at once to minimize layout thrashing
          scrollerRef.current.style.animation = `scroll-${direction} ${animationDuration}s linear infinite`;
          scrollerRef.current.style.animationDirection = directionValue;
          scrollerRef.current.style.animationPlayState = "paused";
          
          // Slight delay to ensure styles are applied before starting animation
          setTimeout(() => {
            if (scrollerRef.current) {
              scrollerRef.current.style.animationPlayState = start ? "running" : "paused";
            }
          }, 50);
        }
      });
    };
    
    setupAnimation();
    
    // Start animation after a short delay to ensure everything is loaded
    const startTimeout = setTimeout(() => setStart(true), 100);
    
    // Handle resize efficiently with debouncing
    const handleResize = () => {
      // Clear previous timeout to implement debouncing
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
      
      // Set a new timeout to prevent frequent recalculations
      resizeTimeoutRef.current = window.setTimeout(() => {
        if (scrollerRef.current) {
          // Pause animation during resize to prevent jumps
          if (scrollerRef.current.style.animationPlayState !== "paused") {
            scrollerRef.current.style.animationPlayState = "paused";
          }
          
          // Recalculate size and restart animation
          setupAnimation();
          
          // Resume animation if not hovering
          if (!isHovering && scrollerRef.current) {
            scrollerRef.current.style.animationPlayState = "running";
          }
        }
      }, 200); // 200ms debounce
    };

    // Use ResizeObserver instead of window resize for better performance
    if (containerRef.current && !resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      if (startTimeout) clearTimeout(startTimeout);
      if (animationRequest) cancelAnimationFrame(animationRequest);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [direction, getSpeed, start, createLoop, loopCreated, isHovering]);

  // Handle mouse hover with debouncing
  const handleMouseEnter = useCallback(() => {
    if (!pauseOnHover || !scrollerRef.current) return;
    
    requestAnimationFrame(() => {
      if (scrollerRef.current) {
        scrollerRef.current.style.animationPlayState = "paused";
        setIsHovering(true);
      }
    });
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (!pauseOnHover || !scrollerRef.current) return;
    
    requestAnimationFrame(() => {
      if (scrollerRef.current) {
        scrollerRef.current.style.animationPlayState = "running";
        setIsHovering(false);
      }
    });
  }, [pauseOnHover]);

  // Add scroll keyframes at mount instead of on every render
  useEffect(() => {
    addScrollKeyframes();
  }, []);

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

// Define keyframes for smooth scrolling - only insert once
let keyframesAdded = false;

export function addScrollKeyframes() {
  if (typeof document !== "undefined" && !keyframesAdded) {
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

      .animation-paused {
        animation-play-state: paused !important;
      }
    `;
    document.head.append(style);
    keyframesAdded = true;
  }
}
