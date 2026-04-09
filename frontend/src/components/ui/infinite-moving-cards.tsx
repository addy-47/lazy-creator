"use client";

import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion, useAnimation, useMotionValue, animate } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  
  const [isHovering, setIsHovering] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const x = useMotionValue(0);
  const controls = useAnimation();
  
  // Speed multiplier
  const speedValue = useMemo(() => {
    return {
      fast: 100,
      normal: 60,
      slow: 30,
    }[speed] || 60;
  }, [speed]);

  // Clone items for loop
  const duplicatedItems = useMemo(() => [...items, ...items, ...items], [items]);

  const startAnimation = useCallback(async (currentX: number) => {
    if (!scrollerRef.current) return;
    
    const scrollerWidth = scrollerRef.current.scrollWidth / 3;
    const targetX = direction === "left" ? -scrollerWidth : scrollerWidth;
    
    // Calculate remaining distance and duration
    const remainingDistance = Math.abs(targetX - currentX);
    const duration = remainingDistance / speedValue;

    await controls.start({
      x: targetX,
      transition: {
        duration,
        ease: "linear",
      },
    });

    // Reset position and recurse
    x.set(0);
    startAnimation(0);
  }, [controls, direction, speedValue, x]);

  useEffect(() => {
    if (items.length > 0) {
      setIsReady(true);
      if (!isInteracting && (!isHovering || !pauseOnHover)) {
        startAnimation(x.get());
      } else {
        controls.stop();
      }
    }
    return () => controls.stop();
  }, [items, isInteracting, isHovering, pauseOnHover, startAnimation, controls, x]);

  // Handle manual navigation
  const handleMove = useCallback((moveDirection: "next" | "prev") => {
    setIsInteracting(true);
    controls.stop();

    const scrollerWidth = scrollerRef.current ? scrollerRef.current.scrollWidth / 3 : 300;
    const moveAmount = 250; // Distance to move per click
    const currentX = x.get();
    
    let newX = moveDirection === "next" 
      ? currentX - moveAmount 
      : currentX + moveAmount;

    // Boundary check for infinite feel
    if (newX < -scrollerWidth) newX += scrollerWidth;
    if (newX > 0) newX -= scrollerWidth;

    animate(x, newX, {
      type: "spring",
      stiffness: 300,
      damping: 30,
      onComplete: () => {
        // Resume auto-scroll after 2 seconds of inactivity
        setTimeout(() => setIsInteracting(false), 2000);
      }
    });
  }, [controls, x]);

  // De-bounce manual interactions
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerManualMove = (dir: "next" | "prev") => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    handleMove(dir);
  };

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "group/container relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Navigation Arrows */}
      <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-2 opacity-0 group-hover/container:opacity-100 transition-opacity">
        <button
          onClick={() => triggerManualMove("prev")}
          className="p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md hover:bg-accent text-foreground transition-all"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      
      <div className="absolute inset-y-0 right-0 z-20 flex items-center pr-2 opacity-0 group-hover/container:opacity-100 transition-opacity">
        <button
          onClick={() => triggerManualMove("next")}
          className="p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-md hover:bg-accent text-foreground transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <motion.div
        ref={scrollerRef}
        animate={controls}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -2000, right: 2000 }} // Large constraints for "infinite" feel
        onDragStart={() => {
          setIsInteracting(true);
          controls.stop();
        }}
        onDragEnd={() => {
          setTimeout(() => setIsInteracting(false), 3000);
        }}
        className={cn(
          "flex min-w-full shrink-0 gap-4 py-4 w-max flex-nowrap cursor-grab active:cursor-grabbing",
          !isReady && "opacity-0"
        )}
      >
        {duplicatedItems.map((item, idx) => (
          <div
            key={`${item.id}-${idx}`}
            className={cn("flex-shrink-0 w-auto", itemClassName)}
          >
            {item.content}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

