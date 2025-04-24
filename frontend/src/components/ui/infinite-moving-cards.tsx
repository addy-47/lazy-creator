"use client";

import React, { useRef, useEffect, useState, useCallback, memo } from "react";
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

// Memoized card item to prevent unnecessary renders
const CardItem = memo(({ 
  content, 
  className 
}: { 
  content: React.ReactNode, 
  className?: string 
}) => {
  return (
    <div
      className={cn("flex-shrink-0 w-auto", className)}
      style={{ willChange: "transform" }}
    >
      {content}
    </div>
  );
});

CardItem.displayName = "CardItem";

// Optimized InfiniteMovingCards component with memoization
export const InfiniteMovingCards = memo(function InfiniteMovingCards({
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
  const animationRef = useRef<number | null>(null);

  // Reduced DOM manipulation by only creating loop once with cleaner approach
  const createLoop = useCallback(() => {
    if (!scrollerRef.current || loopCreated || items.length <= 1) return;

    // Create a single document fragment to batch DOM operations
    const fragment = document.createDocumentFragment();
    
    // Get original children
    const children = Array.from(scrollerRef.current.children);
    
    // Clone all children at once and add to fragment
    children.forEach((child) => {
      const clone = child.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      fragment.appendChild(clone);
    });
    
    // Append all clones in one DOM operation
    scrollerRef.current.appendChild(fragment);
    setLoopCreated(true);
  }, [loopCreated, items.length]);

  // Get speed value with memoization to prevent recalculation
  const speedValue = useCallback(() => {
    return {
      fast: 40,
      normal: 25,
      slow: 15,
    }[speed] || 25;
  }, [speed]);

  // Setup animation with reduced reflows and optimized RAF usage
  const setupAnimation = useCallback(() => {
    if (!scrollerRef.current || !loopCreated) return;
    
    // Cancel previous animation frame if it exists
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Calculate dimensions once to avoid reflows
    const scrollerWidth = scrollerRef.current.scrollWidth;
    const animationDuration = (scrollerWidth / 50) * (speedValue() / 25);
    
    // Batch style updates
    animationRef.current = requestAnimationFrame(() => {
      if (scrollerRef.current) {
        const directionValue = direction === "left" ? "forwards" : "backwards";
        
        // Apply all styles at once to minimize layout thrashing
        Object.assign(scrollerRef.current.style, {
          animation: `scroll-${direction} ${animationDuration}s linear infinite`,
          animationDirection: directionValue,
          animationPlayState: start && !isHovering ? "running" : "paused"
        });
      }
    });
  }, [direction, speedValue, start, loopCreated, isHovering]);

  // Create animation and setup resize handler
  useEffect(() => {
    // Create loop only once on mount
    if (!loopCreated && items.length > 0) {
      createLoop();
    }
    
    // Setup animation after loop creation
    if (loopCreated) {
      setupAnimation();
    }
    
    // Start animation with delay
    const startTimeout = setTimeout(() => {
      setStart(true);
      // After starting, update animation state
      setupAnimation();
    }, 100);
    
    // Debounced resize handler
    const handleResize = () => {
      // Clear previous timeout
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
      
      // Set new timeout with debouncing
      resizeTimeoutRef.current = window.setTimeout(() => {
        setupAnimation();
      }, 200);
    };

    // Use ResizeObserver instead of window resize event
    if (containerRef.current && !resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      if (startTimeout) clearTimeout(startTimeout);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [items.length, createLoop, loopCreated, setupAnimation]);

  // Handle hover with useCallback to prevent recreating functions
  const handleMouseEnter = useCallback(() => {
    if (!pauseOnHover) return;
    
    setIsHovering(true);
    if (scrollerRef.current) {
      scrollerRef.current.style.animationPlayState = "paused";
    }
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (!pauseOnHover) return;
    
    setIsHovering(false);
    if (scrollerRef.current && start) {
      scrollerRef.current.style.animationPlayState = "running";
    }
  }, [pauseOnHover, start]);

  // Add keyframes once on mount
  useEffect(() => {
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
      `;
      document.head.append(style);
      keyframesAdded = true;
    }
  }, []);

  // Optimize render by limiting number of items if too many
  const renderItems = items.length > 15 ? items.slice(0, 15) : items;

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
          start && "animate-scroll"
        )}
      >
        {renderItems.map((item) => (
          <CardItem
            key={item.id}
            content={item.content}
            className={itemClassName}
          />
        ))}
      </div>
    </div>
  );
});

// Define keyframes for smooth scrolling - only insert once
let keyframesAdded = false;
