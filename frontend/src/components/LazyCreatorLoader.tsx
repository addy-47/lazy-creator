import React from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface LazyCreatorLoaderProps {
  progress: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const LazyCreatorLoader: React.FC<LazyCreatorLoaderProps> = ({
  progress,
  size = "md",
  className,
}) => {
  // Size classes for the loader
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-32 h-32",
    lg: "w-40 h-40",
  };

  // Animation variants for the logo parts
  const circleVariants = {
    animate: {
      rotate: 360,
      transition: {
        duration: 8,
        repeat: Infinity,
        ease: "linear",
      },
    },
  };

  const pulseVariants = {
    animate: {
      scale: [1, 1.05, 1],
      opacity: [0.7, 1, 0.7],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  // L shape path for the LazyCreator logo
  const lPath = "M15,10 L15,40 L35,40";

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Outer rotating circle */}
      <motion.div
        className={cn(
          "absolute rounded-full border-4 border-dashed border-[#E0115F]/30",
          sizeClasses[size]
        )}
        variants={circleVariants}
        animate="animate"
      />

      {/* Inner pulsing circle */}
      <motion.div
        className={cn(
          "absolute rounded-full bg-gradient-to-br from-[#E0115F]/20 to-[#800000]/20",
          sizeClasses[size]
        )}
        variants={pulseVariants}
        animate="animate"
      />

      {/* Logo container */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm",
          {
            "w-20 h-20": size === "sm",
            "w-28 h-28": size === "md",
            "w-36 h-36": size === "lg",
          }
        )}
      >
        {/* LazyCreator "L" logo */}
        <svg
          viewBox="0 0 50 50"
          className={cn("text-[#E0115F]", {
            "w-12 h-12": size === "sm",
            "w-16 h-16": size === "md",
            "w-20 h-20": size === "lg",
          })}
        >
          <motion.path
            d={lPath}
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{
              pathLength: progress / 100,
              transition: { duration: 0.5, ease: "easeInOut" },
            }}
          />
        </svg>

        {/* Progress percentage */}
        <div
          className={cn("absolute font-semibold text-[#E0115F]", {
            "text-xs bottom-4": size === "sm",
            "text-sm bottom-5": size === "md",
            "text-base bottom-6": size === "lg",
          })}
        >
          {Math.round(progress)}%
        </div>
      </div>

      {/* Particles animation for extra flair */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#E0115F]"
            initial={{
              x: `calc(50% + ${Math.random() * 20 - 10}px)`,
              y: `calc(50% + ${Math.random() * 20 - 10}px)`,
              opacity: 0,
            }}
            animate={{
              x: `calc(50% + ${Math.random() * 60 - 30}px)`,
              y: `calc(50% + ${Math.random() * 60 - 30}px)`,
              opacity: [0, 0.8, 0],
              scale: [0, 1, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default LazyCreatorLoader;
