import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";

const VideoDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Initialize themeRef with resolvedTheme
  const themeRef = useRef(resolvedTheme || "light");

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

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;
    let step = 0;
    const totalSteps = 600; // 10 seconds at 60fps

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

    // Use a slower frame rate to improve performance
    let frameSkip = 0;
    const FRAME_SKIP_RATE = 3; // Only process every 3rd frame

    const drawDemoFrame = () => {
      if (!ctx || !canvas) return;

      // Implement frame skipping for better performance
      frameSkip = (frameSkip + 1) % FRAME_SKIP_RATE;
      if (frameSkip !== 0) {
        animationFrame = requestAnimationFrame(drawDemoFrame);
        return;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Check current theme state directly from document
      const isDarkMode = document.documentElement.classList.contains("dark");
      themeRef.current = isDarkMode ? "dark" : "light";

      // Set background color based on current theme - improved contrast for light mode
      ctx.fillStyle = themeRef.current === "dark" ? "#111827" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw demo interface
      drawInterface(ctx, canvas, step);

      // Increment step and request next animation frame
      step = (step + 1) % totalSteps;
      animationFrame = requestAnimationFrame(drawDemoFrame);
    };

    // Start animation
    drawDemoFrame();

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("storage", handleThemeChange);
      observer.disconnect();
    };
  }, [mounted]);

  const drawInterface = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    currentStep: number
  ) => {
    const { width, height } = canvas;
    
    // Define app frame dimensions (centered in canvas)
    const appWidth = width * 0.8;
    const appHeight = height * 0.7;
    const appX = (width - appWidth) / 2;
    const appY = (height - appHeight) / 2;
    
    // Set up app frame with better contrast for light mode
    ctx.save();
    // App background with better contrast in light mode
    ctx.fillStyle = themeRef.current === "dark" 
      ? "rgba(30, 41, 59, 0.8)" 
      : "rgba(240, 240, 246, 0.95)";
    ctx.strokeStyle = themeRef.current === "dark" 
      ? "rgba(255, 255, 255, 0.1)" 
      : "rgba(0, 0, 0, 0.15)";
    
    // Draw app container
    ctx.beginPath();
    ctx.roundRect(appX, appY, appWidth, appHeight, 12);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Draw app frame with glass effect using updated themeRef - improved contrast for light mode
    const barHeight = height * 0.05;
    
    // App header with better contrast
    ctx.fillStyle = themeRef.current === "dark" 
      ? "rgba(30, 41, 59, 0.9)" 
      : "rgba(230, 230, 240, 0.9)";
    ctx.beginPath();
    ctx.roundRect(appX, appY, appWidth, barHeight, [12, 12, 0, 0]);
    ctx.fill();
    
    // App controls/buttons with better contrast
    ctx.fillStyle = themeRef.current === "dark" 
      ? "rgba(255, 255, 255, 0.9)" 
      : "rgba(50, 50, 50, 0.9)";
    
    // Window control dots
    [0.2, 0.35, 0.5].forEach((pos) => {
      ctx.beginPath();
      ctx.arc(
        appX + appWidth * pos,
        appY + barHeight / 2,
        barHeight * 0.25,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
    
    // Adding a placeholder navigation bar with better contrast
    const navHeight = height * 0.06;
    ctx.fillStyle = themeRef.current === "dark" 
      ? "rgba(40, 50, 70, 0.8)" 
      : "rgba(245, 245, 250, 0.9)";
    ctx.beginPath();
    ctx.roundRect(
      appX,
      appY + barHeight,
      appWidth,
      navHeight,
      0
    );
    ctx.fill();
    
    // Create nav items with better contrast
    const items = 5;
    const itemWidth = appWidth / items;
    
    ctx.fillStyle = themeRef.current === "dark" 
      ? "rgba(70, 90, 120, 0.7)" 
      : "rgba(220, 220, 230, 0.8)";
    for (let i = 0; i < items; i++) {
      if (Math.random() > 0.5) continue; // Skip some items for variety
      
      ctx.beginPath();
      ctx.roundRect(
        appX + i * itemWidth + itemWidth * 0.1,
        appY + barHeight + navHeight * 0.2,
        itemWidth * 0.8,
        navHeight * 0.6,
        4
      );
      ctx.fill();
    }
    
    // Content area with animated elements - using better contrast
    const contentY = appY + barHeight + navHeight;
    const contentHeight = appHeight - barHeight - navHeight;
    
    // Add dynamic content with better contrast
    ctx.fillStyle = themeRef.current === "dark" 
      ? "rgba(50, 65, 85, 0.6)" 
      : "rgba(235, 235, 245, 0.7)";
    
    // Calculate a variety of shapes based on time step
    const shapes = 6;
    const shapePadding = contentHeight * 0.1;
    const shapeHeight = (contentHeight - shapePadding * (shapes + 1)) / shapes;
    
    for (let i = 0; i < shapes; i++) {
      const y = contentY + shapePadding + (shapeHeight + shapePadding) * i;
      
      // Make shapes dynamic based on time
      const widthMultiplier = 0.5 + Math.sin(currentStep / 20 + i) * 0.3;
      
      ctx.beginPath();
      ctx.roundRect(
        appX + appWidth * 0.1,
        y,
        appWidth * 0.8 * widthMultiplier,
        shapeHeight,
        8
      );
      ctx.fill();
    }
    
    // Animation phase based on current step
    const phase = Math.floor(currentStep / 150) % 4;
    if (phase === 0) {
      drawPromptSelection(ctx, width, height, currentStep % 150);
    } else if (phase === 1) {
      drawDurationSlider(ctx, width, height, currentStep % 150);
    } else if (phase === 2) {
      drawBackgroundSelection(ctx, width, height, currentStep % 150);
    } else {
      drawVideoGeneration(ctx, width, height, currentStep % 150);
    }

    // Add stick figure mascot based on the phase
    drawStickFigure(ctx, width, height, currentStep, phase);
  };

  // Update text color variables with better contrast for light mode
  const getTextColor = () => {
    return themeRef.current === "dark" ? "rgba(255, 255, 255, 0.9)" : "rgba(15, 23, 42, 0.9)";
  };

  const getSubtextColor = () => {
    return themeRef.current === "dark" ? "rgba(209, 213, 219, 0.8)" : "rgba(71, 85, 105, 0.9)";
  };

  const drawStickFigure = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number,
    phase: number
  ) => {
    let x = width * 0.9;
    let y = height * 0.85;

    if (phase === 0) {
      x = width * 0.85;
      y = height * 0.85 - (step % 150 < 30 ? (step % 30) * 2 : 60);
    } else if (phase === 1) {
      x = width * (0.85 - ((step % 150) / 150) * 0.7);
      y = height * 0.85;
    } else if (phase === 2) {
      x = width * 0.15;
      y = height * (0.85 - Math.sin((step % 150) / 25) * 0.1);
    } else {
      x = width * 0.15;
      y = height * 0.85;
    }

    // Draw stick figure with improved contrast
    ctx.strokeStyle = themeRef.current === "dark" ? "#E0115F" : "#800000";
    ctx.fillStyle = themeRef.current === "dark" ? "#E0115F" : "#800000";
    ctx.lineWidth = 3;

    // Draw head
    ctx.beginPath();
    ctx.arc(x, y - 30, 12, 0, Math.PI * 2);
    ctx.fill();

    // Draw body
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x, y - 5);
    ctx.stroke();

    // Draw arms
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x - 10, y - 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x + 10, y - 5);
    ctx.stroke();

    // Draw legs
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x - 8, y + 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 8, y + 10);
    ctx.stroke();
  };

  const drawPromptSelection = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    const centerX = width * 0.5;
    const centerY = height * 0.4;
    const boxWidth = width * 0.6;
    const boxHeight = height * 0.25;

    // Draw title with improved contrast
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = getTextColor();
    ctx.textAlign = "center";
    ctx.fillText("Select a Prompt", centerX, centerY - boxHeight * 0.6);

    // Draw subtitle
    ctx.font = "16px Arial";
    ctx.fillStyle = getSubtextColor();
    ctx.fillText(
      "Choose from trending topics or create your own",
      centerX,
      centerY - boxHeight * 0.4
    );

    // Draw prompt suggestions
    const promptOptions = [
      "Day in the Life",
      "Product Review",
      "How-To Tutorial",
      "Trending Challenge",
    ];

    const boxPadding = 15;
    const promptBoxHeight = 40;
    const promptSpacing = 15;
    const startY = centerY - promptBoxHeight * 1.5 - promptSpacing;

    promptOptions.forEach((prompt, index) => {
      const promptY = startY + (promptBoxHeight + promptSpacing) * index;

      // Determine if this prompt is selected based on animation step
      const isSelected = Math.floor((step % 150) / 30) === index;

      // Draw the selection box
      ctx.fillStyle = isSelected
        ? themeRef.current === "dark"
          ? "rgba(224, 17, 95, 0.8)"
          : "rgba(224, 17, 95, 0.8)" // Same selected color in both modes
        : themeRef.current === "dark"
        ? "rgba(30, 41, 59, 0.8)"
        : "rgba(241, 245, 249, 0.9)"; // Better contrast for light mode
      
      ctx.beginPath();
      ctx.roundRect(
        centerX - boxWidth * 0.25,
        promptY,
        boxWidth * 0.5,
        promptBoxHeight,
        10
      );
      ctx.fill();

      // Draw prompt text
      ctx.font = isSelected ? "bold 16px Arial" : "16px Arial";
      ctx.fillStyle = isSelected
        ? "#ffffff" // White text for selected item
        : getTextColor(); // Regular text color
      ctx.textAlign = "center";
      ctx.fillText(
        prompt,
        centerX,
        promptY + promptBoxHeight / 2 + 5
      );
    });
  };

  const drawDurationSlider = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    const centerX = width * 0.5;
    const centerY = height * 0.4;
    const sliderWidth = width * 0.6;
    const sliderHeight = 8;

    // Draw title with improved contrast
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = getTextColor();
    ctx.textAlign = "center";
    ctx.fillText("Set Duration", centerX, centerY - 60);

    // Draw subtitle
    ctx.font = "16px Arial";
    ctx.fillStyle = getSubtextColor();
    ctx.fillText(
      "Choose the perfect length for your Short",
      centerX,
      centerY - 30
    );

    // Draw slider track
    ctx.fillStyle = themeRef.current === "dark" ? "rgba(55, 65, 81, 0.8)" : "rgba(226, 232, 240, 0.9)";
    ctx.beginPath();
    ctx.roundRect(
      centerX - sliderWidth / 2,
      centerY,
      sliderWidth,
      sliderHeight,
      4
    );
    ctx.fill();

    // Calculate slider position based on animation step
    const sliderPos =
      centerX -
      sliderWidth / 2 +
      (sliderWidth * (step < 75 ? step : 150 - step)) / 150;

    // Draw slider filled portion
    ctx.fillStyle = themeRef.current === "dark" ? "#E0115F" : "#800000";
    ctx.beginPath();
    ctx.roundRect(
      centerX - sliderWidth / 2,
      centerY,
      sliderPos - (centerX - sliderWidth / 2),
      sliderHeight,
      4
    );
    ctx.fill();

    // Draw slider handle
    ctx.beginPath();
    ctx.arc(sliderPos, centerY + sliderHeight / 2, 12, 0, Math.PI * 2);
    ctx.fill();

    // Draw duration value
    const duration = Math.floor(((step < 75 ? step : 150 - step) / 150) * 60);
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = getTextColor();
    ctx.fillText(
      `${duration} seconds`,
      centerX,
      centerY + 40
    );
  };

  const drawBackgroundSelection = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    const centerX = width * 0.5;
    const topY = height * 0.25;
    const gridWidth = width * 0.6;
    const gridHeight = height * 0.4;

    // Draw title with improved contrast
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = getTextColor();
    ctx.textAlign = "center";
    ctx.fillText("Choose Background", centerX, topY - 20);

    // Draw grid of background options
    const columns = 3;
    const rows = 2;
    const thumbnailWidth = gridWidth / columns;
    const thumbnailHeight = gridHeight / rows;
    const padding = 10;

    // Selected index based on animation step
    const selectedIndex = Math.floor((step % 150) / 25);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        
        // Thumbnail position
        const thumbX = centerX - gridWidth / 2 + col * thumbnailWidth;
        const thumbY = topY + row * thumbnailHeight;
        
        // Check if this thumbnail is currently selected
        const isSelected = selectedIndex === index;
        
        // Draw thumbnail background with improved contrast
        ctx.fillStyle = themeRef.current === "dark" 
          ? isSelected ? "rgba(224, 17, 95, 0.4)" : "rgba(30, 41, 59, 0.9)"
          : isSelected ? "rgba(224, 17, 95, 0.3)" : "rgba(241, 245, 249, 0.9)";
        
        ctx.beginPath();
        ctx.roundRect(
          thumbX + padding,
          thumbY + padding,
          thumbnailWidth - padding * 2,
          thumbnailHeight - padding * 2,
          8
        );
        ctx.fill();
        
        // Draw border for selected thumbnail
        if (isSelected) {
          ctx.strokeStyle = themeRef.current === "dark" ? "#E0115F" : "#800000";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        
        // Draw thumbnail content preview
        const iconSize = Math.min(thumbnailWidth, thumbnailHeight) * 0.3;
        const iconX = thumbX + thumbnailWidth / 2;
        const iconY = thumbY + thumbnailHeight / 2;
        
        // Draw different icon shapes for different thumbnails
        ctx.fillStyle = themeRef.current === "dark" ? "#FFFFFF" : "#1E293B";
        
        if (index === 0) {
          // Mountain icon
          ctx.beginPath();
          ctx.moveTo(iconX - iconSize, iconY + iconSize/2);
          ctx.lineTo(iconX - iconSize/2, iconY - iconSize/2);
          ctx.lineTo(iconX, iconY + iconSize/3);
          ctx.lineTo(iconX + iconSize/2, iconY - iconSize/3);
          ctx.lineTo(iconX + iconSize, iconY + iconSize/2);
          ctx.closePath();
          ctx.fill();
        } else if (index === 1) {
          // Building icon
          ctx.beginPath();
          ctx.roundRect(
            iconX - iconSize/2,
            iconY - iconSize/2,
            iconSize,
            iconSize,
            2
          );
          ctx.fill();
          
          // Windows
          ctx.fillStyle = themeRef.current === "dark" ? "#1E293B" : "#FFFFFF";
          const windowSize = iconSize / 4;
          ctx.beginPath();
          ctx.rect(iconX - iconSize/4, iconY - iconSize/4, windowSize, windowSize);
          ctx.fill();
          
          ctx.beginPath();
          ctx.rect(iconX + iconSize/4 - windowSize, iconY - iconSize/4, windowSize, windowSize);
          ctx.fill();
          
          ctx.beginPath();
          ctx.rect(iconX - iconSize/4, iconY + iconSize/4 - windowSize, windowSize, windowSize);
          ctx.fill();
          
          ctx.beginPath();
          ctx.rect(iconX + iconSize/4 - windowSize, iconY + iconSize/4 - windowSize, windowSize, windowSize);
          ctx.fill();
        } else {
          // Abstract shapes for other thumbnails
          ctx.beginPath();
          ctx.arc(iconX, iconY, iconSize/2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };

  const drawVideoGeneration = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    const centerX = width * 0.5;
    const centerY = height * 0.4;
    
    // Draw title with improved contrast
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = getTextColor();
    ctx.textAlign = "center";
    ctx.fillText("Generating Your Short", centerX, centerY - 70);
    
    // Draw progress subtitle
    const progressPercent = Math.min(100, Math.floor((step / 150) * 100));
    ctx.font = "16px Arial";
    ctx.fillStyle = getSubtextColor();
    ctx.fillText(
      `${progressPercent}% Complete`,
      centerX,
      centerY - 40
    );
    
    // Draw progress bar
    const progressWidth = width * 0.6;
    const progressHeight = 12;
    
    // Progress bar background with improved contrast
    ctx.fillStyle = themeRef.current === "dark" ? "rgba(55, 65, 81, 0.8)" : "rgba(226, 232, 240, 0.9)";
    ctx.beginPath();
    ctx.roundRect(
      centerX - progressWidth / 2,
      centerY,
      progressWidth,
      progressHeight,
      6
    );
    ctx.fill();
    
    // Progress bar fill
    const fillWidth = (progressWidth * step) / 150;
    ctx.fillStyle = themeRef.current === "dark" ? "#E0115F" : "#800000";
    ctx.beginPath();
    ctx.roundRect(
      centerX - progressWidth / 2,
      centerY,
      fillWidth,
      progressHeight,
      6
    );
    ctx.fill();
    
    // Draw status messages that change during the progress
    const statusMessages = [
      "Analyzing content...",
      "Generating script...",
      "Creating visuals...",
      "Applying effects...",
      "Finalizing export..."
    ];
    
    const messageIndex = Math.min(
      statusMessages.length - 1,
      Math.floor((step / 150) * statusMessages.length)
    );
    
    ctx.font = "16px Arial";
    ctx.fillStyle = getTextColor();
    ctx.fillText(
      statusMessages[messageIndex],
      centerX,
      centerY + 40
    );
    
    // Draw animated dots to indicate processing
    const dotCount = (Math.floor(step / 15) % 4);
    let dots = "";
    for (let i = 0; i < dotCount; i++) {
      dots += ".";
    }
    
    ctx.fillText(dots, centerX + ctx.measureText(statusMessages[messageIndex]).width / 2 + 10, centerY + 40);
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
          {/* Video demo canvas */}
          <div className="relative mx-auto w-full max-w-[320px] md:max-w-[540px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-4 border-[#E0115F]/10 dark:border-[#E0115F]/20">
            <canvas
              ref={canvasRef}
              width={1080}
              height={1920}
              className="w-full h-full"
            ></canvas>
          </div>

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-[#E0115F]"></div>
                <span className="text-white text-sm font-medium">
                  Recording
                </span>
              </div>
              <div className="text-white text-sm">00:15</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoDemo;
