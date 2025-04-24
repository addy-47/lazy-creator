import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";

const VideoDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const throttleTimerRef = useRef<number | null>(null);

  // Initialize themeRef with resolvedTheme
  const themeRef = useRef(resolvedTheme || "light");

  // Check if device is low-end
  const isLowEndDevice = typeof window !== "undefined" && (
    window.navigator.hardwareConcurrency < 4 || 
    window.innerWidth < 768 || 
    navigator.userAgent.includes("Mobile")
  );

  useEffect(() => {
    setMounted(true);

    // Force immediate theme check
    const checkDocumentTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      themeRef.current = isDark ? "dark" : "light";
    };

    checkDocumentTheme();
  }, []);

  // Update themeRef when resolvedTheme changes
  useEffect(() => {
    if (resolvedTheme) {
      themeRef.current = resolvedTheme;

      // Force redraw if canvas is ready
      if (canvasRef.current && canvasRef.current.getContext("2d")) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }
      }
    }
  }, [resolvedTheme]);

  // Draw a static frame for low-end devices
  const drawStaticFrame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set background color based on current theme
    ctx.fillStyle = themeRef.current === "dark" ? "#111827" : "#f8fafc";
    ctx.fillRect(0, 0, width, height);

    // Draw app frame with glass effect
    ctx.fillStyle =
      themeRef.current === "dark"
        ? "rgba(30, 41, 59, 0.8)"
        : "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.roundRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8, 20);
    ctx.fill();

    // Add simple content - just the completed state
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "bold 20px Inter";
    ctx.fillText("LazyCreator Demo", width * 0.2, height * 0.2);

    // Add a completed checkmark
    const centerX = width * 0.5;
    const centerY = height * 0.4;
    const radius = Math.min(width, height) * 0.1;

    // Draw green circle
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw checkmark
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(centerX - radius * 0.5, centerY);
    ctx.lineTo(centerX - radius * 0.1, centerY + radius * 0.4);
    ctx.lineTo(centerX + radius * 0.5, centerY - radius * 0.4);
    ctx.stroke();
  };

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // For low-end devices, just draw a static frame and exit
    if (isLowEndDevice) {
      drawStaticFrame(ctx, canvas);
      return;
    }

    let step = 0;
    const totalSteps = 600; // 10 seconds at 60fps
    const targetFps = 30; // Reduce to 30fps for better performance
    const frameInterval = 1000 / targetFps;

    // Initial theme check before starting animation
    const isDarkMode = document.documentElement.classList.contains("dark");
    themeRef.current = isDarkMode ? "dark" : "light";

    // Handle theme changes from Navbar or system
    const handleThemeChange = () => {
      // Check if document is already using dark mode
      const isDark = document.documentElement.classList.contains("dark");
      themeRef.current = isDark ? "dark" : "light";

      // Force redraw by clearing the canvas
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    // Listen for storage events for theme changes
    window.addEventListener("storage", handleThemeChange);

    // Also check for theme changes on document class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          handleThemeChange();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    const drawDemoFrame = () => {
      if (!ctx || !canvas) return;
      
      // Skip if canvas is not visible
      const rect = canvas.getBoundingClientRect();
      const isVisible = 
        rect.top < window.innerHeight && 
        rect.bottom >= 0 && 
        rect.width > 0 && 
        rect.height > 0;
        
      if (!isVisible) {
        // If not visible, request next frame but with lower frequency
        animationFrameRef.current = requestAnimationFrame(() => {
          if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
          throttleTimerRef.current = window.setTimeout(drawDemoFrame, 200);
        });
        return;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Check current theme state directly from document
      const isDarkMode = document.documentElement.classList.contains("dark");
      themeRef.current = isDarkMode ? "dark" : "light";

      // Set background color based on current theme
      ctx.fillStyle = themeRef.current === "dark" ? "#111827" : "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw demo interface
      drawInterface(ctx, canvas, step);

      // Increment step and request next animation frame with throttling
      step = (step + 1) % totalSteps;
      
      // Throttle the animation to achieve target fps
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = window.setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(drawDemoFrame);
      }, frameInterval);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(drawDemoFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
      window.removeEventListener("storage", handleThemeChange);
      observer.disconnect();
    };
  }, [mounted, isLowEndDevice]);

  const drawInterface = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    currentStep: number
  ) => {
    const width = canvas.width;
    const height = canvas.height;

    // Draw app frame with glass effect using updated themeRef
    ctx.fillStyle =
      themeRef.current === "dark"
        ? "rgba(30, 41, 59, 0.8)"
        : "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.roundRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8, 20);
    ctx.fill();

    // Simple border instead of complex stroke
    ctx.strokeStyle =
      themeRef.current === "dark"
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Simplified glassmorphism (fewer gradient stops)
    const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.1);
    gradient.addColorStop(
      0,
      themeRef.current === "dark"
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(255, 255, 255, 0.7)"
    );
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(
      width * 0.1,
      height * 0.1,
      width * 0.8,
      height * 0.05,
      [20, 20, 0, 0]
    );
    ctx.fill();

    // Animation phase based on current step - simplified to fewer phases
    const phase = Math.floor(currentStep / 200) % 3; // 3 phases instead of 4
    if (phase === 0) {
      drawPromptSelection(ctx, width, height, currentStep % 200);
    } else if (phase === 1) {
      drawDurationSlider(ctx, width, height, currentStep % 200);
    } else {
      drawVideoGeneration(ctx, width, height, currentStep % 200);
    }

    // Simplified stick figure with fewer animation details
    if (!isLowEndDevice) {
      drawStickFigure(ctx, width, height, currentStep, phase);
    }
  };

  const drawStickFigure = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    phase: number
  ) => {
    // Simplified stick figure position calculations
    let x = width * 0.85;
    let y = height * 0.85;

    if (phase === 0) {
      // Less complex animation
      y = height * 0.8;
    } else if (phase === 1) {
      x = width * 0.5;
    }

    // Updated color to match site theme (from blue to red)
    const primaryColor = themeRef.current === "dark" ? "#E0115F" : "#800000";

    // Draw stick figure head
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(x, y - 15, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw stick figure body (simplified)
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 7);
    ctx.stroke();

    // Draw arms (simplified - fewer animations)
    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x + 8, y - 7);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x - 8, y - 7);
    ctx.stroke();

    // Draw legs (simplified)
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x + 8, y + 15);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x - 8, y + 15);
    ctx.stroke();
  };

  const drawPromptSelection = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    // Simplify drawing operations - reduce text rendering and effects
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "bold 16px Inter";
    ctx.fillText("Enter prompt:", width * 0.15, height * 0.2);

    // Draw input box
    ctx.fillStyle = themeRef.current === "dark" ? "#1e293b" : "#f1f5f9";
    ctx.beginPath();
    ctx.roundRect(width * 0.15, height * 0.25, width * 0.7, height * 0.1, 10);
    ctx.fill();

    // Skip shadow effects for better performance
    ctx.strokeStyle = themeRef.current === "dark" ? "#334155" : "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Only show text cursor animation in certain step ranges - simplified
    if (Math.floor(step / 20) % 2 === 0) {
      const promptText = "AI Fashion Tips";
      const textWidth = ctx.measureText(promptText).width;
      
      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.fillText(
        promptText,
        width * 0.18,
        height * 0.31
      );

      // Draw cursor
      ctx.fillRect(
        width * 0.18 + textWidth + 5,
        height * 0.26,
        2,
        height * 0.08
      );
    } else {
      const promptText = "AI Fashion Tips";
      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.fillText(
        promptText,
        width * 0.18,
        height * 0.31
      );
    }

    // Simplified trending topics
    const topics = ["AI News", "Workout", "Recipes", "Technology"];
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "bold 14px Inter";
    ctx.fillText("Trending topics:", width * 0.15, height * 0.45);

    // Simplified topic rendering - fewer effects
    topics.forEach((topic, index) => {
      ctx.fillStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(
        width * (0.15 + index * 0.18),
        height * 0.5,
        width * 0.16,
        height * 0.06,
        15
      );
      ctx.fill();

      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "12px Inter";
      ctx.fillText(
        topic,
        width * (0.15 + index * 0.18 + 0.02),
        height * 0.53
      );
    });
  };

  const drawDurationSlider = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    // Simplified slider animation
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "bold 16px Inter";
    ctx.fillText("Select Duration", width * 0.15, height * 0.2);

    // Simplified slider track
    ctx.fillStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(width * 0.15, height * 0.3, width * 0.7, height * 0.05, 10);
    ctx.fill();

    // Reduced complexity in animation
    const sliderProgress = Math.min(0.7, Math.max(0.1, step / 200));
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.roundRect(
      width * 0.15,
      height * 0.3,
      width * sliderProgress,
      height * 0.05,
      10
    );
    ctx.fill();

    // Simplified slider handle - no shadows
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(
      width * (0.15 + sliderProgress),
      height * 0.325,
      10,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "14px Inter";
    ctx.fillText(
      `${Math.round((sliderProgress / 0.7) * 20 + 10)}s`,
      width * (0.15 + sliderProgress),
      height * 0.4
    );
  };

  const drawVideoGeneration = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    if (step < 30) {
      // Simplified button
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.roundRect(width * 0.3, height * 0.7, width * 0.4, height * 0.1, 10);
      ctx.fill();

      // No shadows for better performance
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Inter";
      ctx.fillText("Create Short", width * 0.42, height * 0.76);
    } else {
      // Simplified progress display
      const progress = (step - 30) / 170;

      ctx.fillStyle =
        themeRef.current === "dark"
          ? "rgba(17, 24, 39, 0.9)"
          : "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);

      // Simplified spinner
      const spinnerRadius = Math.min(width, height) * 0.1;
      const spinnerCenterX = width * 0.5;
      const spinnerCenterY = height * 0.3;

      ctx.strokeStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(spinnerCenterX, spinnerCenterY, spinnerRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Remove shadows for better performance
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(
        spinnerCenterX,
        spinnerCenterY,
        spinnerRadius,
        -Math.PI / 2,
        -Math.PI / 2 + progress * Math.PI * 2
      );
      ctx.stroke();

      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 18px Inter";
      const timeLeft = Math.ceil(300 - progress * 300);
      
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      const timeDisplay = timeLeft > 0 
        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
        : "Complete!";
      
      ctx.fillText(timeDisplay, spinnerCenterX - 25, spinnerCenterY + 7);

      // Simplified status text
      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 14px Inter";
      
      // Skip complex calculations for status text
      const statusText = progress < 0.3 ? "Generating script..."
                       : progress < 0.6 ? "Creating visuals..."
                       : progress < 0.9 ? "Rendering video..."
                       : "Processing complete!";
      
      ctx.fillText(statusText, width * 0.5 - 70, height * 0.45);

      // Simplified progress bar
      ctx.fillStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(width * 0.2, height * 0.5, width * 0.6, height * 0.02, 4);
      ctx.fill();

      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.roundRect(
        width * 0.2,
        height * 0.5,
        width * 0.6 * progress,
        height * 0.02,
        4
      );
      ctx.fill();

      // Show video thumbnail when complete - simplified
      if (progress > 0.95) {
        // Simplified thumbnail
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.roundRect(width * 0.25, height * 0.55, width * 0.5, height * 0.25, 8);
        ctx.fill();
        
        // Checkmark
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(width * 0.4, height * 0.67);
        ctx.lineTo(width * 0.45, height * 0.71);
        ctx.lineTo(width * 0.6, height * 0.63);
        ctx.stroke();
      }
    }
  };

  return (
    <section className="py-20 relative">
      <div className="container-tight relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <h2 className="font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#800000] to-[#E0115F] dark:from-[#E0115F] dark:to-[#722F37]">
            See It In Action
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Watch how LazyCreator transforms your ideas into engaging YouTube
            Shorts
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Video demo canvas - Add loading="lazy" for better performance */}
          <div className="relative mx-auto w-full max-w-[320px] md:max-w-[540px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-4 border-[#E0115F]/10 dark:border-[#E0115F]/20">
            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              className="w-full h-full"
              loading="lazy"
            ></canvas>
          </div>

          {/* Controls overlay - simplified */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#E0115F]"></div>
                <span className="text-white text-sm font-medium">
                  Preview
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoDemo;
