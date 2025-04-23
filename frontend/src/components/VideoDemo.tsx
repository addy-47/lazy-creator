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

    const drawDemoFrame = () => {
      if (!ctx || !canvas) return;

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

    ctx.strokeStyle =
      themeRef.current === "dark"
        ? "rgba(255, 255, 255, 0.1)"
        : "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Add glassmorphism shine
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
      x = width * 0.8;
      y = height * 0.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(((step % 150) / 150) * Math.PI * 2);
      ctx.translate(-x, -y);
    }

    // Updated color to match site theme (from blue to red)
    const primaryColor = themeRef.current === "dark" ? "#E0115F" : "#800000";

    // Draw stick figure head
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(x, y - 15, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw stick figure body
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 7);
    ctx.lineTo(x, y + 7);
    ctx.stroke();

    // Draw arms
    if (phase === 0 || phase === 3) {
      const waveAngle = Math.sin((step % 150) / 15) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(
        x + Math.cos(waveAngle) * 12,
        y - 7 - Math.sin(waveAngle) * 12
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x - 8, y - 7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 8, y - 7);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x - 8, y - 7);
      ctx.stroke();
    }

    // Draw legs
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x + 8, y + 15);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x - 8, y + 15);
    ctx.stroke();

    if (phase === 3) {
      ctx.restore();
    }
  };

  const drawPromptSelection = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "bold 16px Inter";
    ctx.fillText("Select a Prompt", width * 0.15, height * 0.2);

    const promptColors = [
      themeRef.current === "dark" ? "#3b82f6" : "#3b82f6",
      themeRef.current === "dark" ? "#334155" : "#e2e8f0",
      themeRef.current === "dark" ? "#334155" : "#e2e8f0",
      themeRef.current === "dark" ? "#334155" : "#e2e8f0",
    ];

    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = promptColors[i];
      ctx.beginPath();
      ctx.roundRect(
        width * (0.15 + i * 0.15),
        height * 0.25,
        width * 0.12,
        height * 0.08,
        20
      );
      ctx.fill();

      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle =
        i === 0
          ? "#ffffff"
          : themeRef.current === "dark"
          ? "#e2e8f0"
          : "#0f172a";
      ctx.font = "12px Inter";
      ctx.fillText(
        `Prompt ${i + 1}`,
        width * (0.15 + i * 0.15) + 10,
        height * 0.25 + 20
      );
    }

    const progress = Math.min(1, step / 100);
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "14px Inter";
    ctx.fillText("Prompt Selected", width * 0.15, height * 0.4);

    if (step > 100) {
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 14px Inter";
      ctx.fillText("✓", width * 0.35, height * 0.4);
    }
  };

  const drawDurationSlider = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "bold 16px Inter";
    ctx.fillText("Select Duration", width * 0.15, height * 0.2);

    ctx.fillStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(width * 0.15, height * 0.3, width * 0.7, height * 0.05, 10);
    ctx.fill();

    const sliderProgress = Math.min(0.7, Math.max(0, (step / 150) * 0.7));
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

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(
      width * (0.15 + sliderProgress),
      height * 0.325,
      12,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.shadowColor = "#3b82f6";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(width * (0.15 + sliderProgress), height * 0.325, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "14px Inter";
    ctx.fillText(
      `${Math.round((sliderProgress / 0.7) * 20 + 10)}s`,
      width * (0.15 + sliderProgress),
      height * 0.4
    );

    if (step > 120) {
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 14px Inter";
      ctx.fillText("Duration Selected ✓", width * 0.15, height * 0.5);
    }
  };

  const drawBackgroundSelection = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "bold 16px Inter";
    ctx.fillText("Select Background", width * 0.15, height * 0.2);

    ctx.fillStyle =
      step < 70
        ? "#3b82f6"
        : themeRef.current === "dark"
        ? "#334155"
        : "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(width * 0.15, height * 0.25, width * 0.2, height * 0.1, 10);
    ctx.fill();
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "14px Inter";
    ctx.fillText("Image", width * 0.21, height * 0.3);

    ctx.fillStyle =
      step >= 70
        ? "#3b82f6"
        : themeRef.current === "dark"
        ? "#334155"
        : "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(width * 0.4, height * 0.25, width * 0.2, height * 0.1, 10);
    ctx.fill();
    ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
    ctx.font = "14px Inter";
    ctx.fillText("Video", width * 0.46, height * 0.3);

    if (step > 90) {
      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 14px Inter";
      ctx.fillText("Source:", width * 0.15, height * 0.45);

      ctx.fillStyle =
        step < 120
          ? "#3b82f6"
          : themeRef.current === "dark"
          ? "#334155"
          : "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(
        width * 0.15,
        height * 0.5,
        width * 0.25,
        height * 0.08,
        10
      );
      ctx.fill();
      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "14px Inter";
      ctx.fillText("Use our library", width * 0.19, height * 0.55);

      ctx.fillStyle =
        step >= 120
          ? "#3b82f6"
          : themeRef.current === "dark"
          ? "#334155"
          : "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(
        width * 0.45,
        height * 0.5,
        width * 0.25,
        height * 0.08,
        10
      );
      ctx.fill();
      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "14px Inter";
      ctx.fillText("Upload your own", width * 0.49, height * 0.55);
    }
  };

  const drawVideoGeneration = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    step: number
  ) => {
    if (step < 30) {
      const gradient = ctx.createLinearGradient(
        width * 0.3,
        height * 0.7,
        width * 0.7,
        height * 0.8
      );
      gradient.addColorStop(0, "#3b82f6");
      gradient.addColorStop(1, "#2563eb");
      ctx.fillStyle = gradient;

      ctx.beginPath();
      ctx.roundRect(width * 0.3, height * 0.7, width * 0.4, height * 0.1, 10);
      ctx.fill();

      ctx.shadowColor = "#3b82f680";
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Inter";
      ctx.fillText("Create Short", width * 0.42, height * 0.76);

      if (step > 15) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.75, (step - 15) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (step <= 120) {
      const progress = (step - 30) / 90;

      ctx.fillStyle =
        themeRef.current === "dark"
          ? "rgba(17, 24, 39, 0.9)"
          : "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);

      const spinnerRadius = Math.min(width, height) * 0.1;
      const spinnerCenterX = width * 0.5;
      const spinnerCenterY = height * 0.3;

      ctx.strokeStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(spinnerCenterX, spinnerCenterY, spinnerRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowColor = "#3b82f680";
      ctx.shadowBlur = 10;
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
      ctx.shadowBlur = 0;

      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 20px Inter";
      const timeLeft = Math.ceil(30 - progress * 30);
      ctx.fillText(`${timeLeft}s`, spinnerCenterX - 15, spinnerCenterY + 7);

      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 18px Inter";
      ctx.fillText("Generating your Short...", width * 0.5 - 100, height * 0.5);

      ctx.fillStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(width * 0.25, height * 0.6, width * 0.5, height * 0.03, 5);
      ctx.fill();

      const barGradient = ctx.createLinearGradient(
        width * 0.25,
        0,
        width * 0.75,
        0
      );
      barGradient.addColorStop(0, "#3b82f6");
      barGradient.addColorStop(1, "#2563eb");
      ctx.fillStyle = barGradient;

      ctx.beginPath();
      ctx.roundRect(
        width * 0.25,
        height * 0.6,
        width * 0.5 * progress,
        height * 0.03,
        5
      );
      ctx.fill();

      const steps = [
        "Analyzing prompt",
        "Generating content",
        "Adding background",
        "Finalizing",
      ];
      const stepActive = Math.floor(progress * 4);

      for (let i = 0; i < steps.length; i++) {
        if (i <= stepActive) {
          ctx.fillStyle =
            i === stepActive
              ? "#3b82f6"
              : themeRef.current === "dark"
              ? "#e2e8f0"
              : "#0f172a";
          ctx.font = i === stepActive ? "bold 14px Inter" : "14px Inter";
        } else {
          ctx.fillStyle = themeRef.current === "dark" ? "#64748b" : "#9ca3af";
          ctx.font = "14px Inter";
        }
        ctx.fillText(steps[i], width * (0.25 + i * 0.17), height * 0.7);
      }
    } else {
      const videoGradient = ctx.createLinearGradient(
        0,
        height * 0.2,
        0,
        height * 0.6
      );
      videoGradient.addColorStop(
        0,
        themeRef.current === "dark" ? "#1e293b" : "#0f172a"
      );
      videoGradient.addColorStop(
        1,
        themeRef.current === "dark" ? "#0f172a" : "#1e293b"
      );

      ctx.fillStyle = videoGradient;
      ctx.beginPath();
      ctx.roundRect(width * 0.2, height * 0.2, width * 0.6, height * 0.4, 10);
      ctx.fill();

      ctx.strokeStyle = "#3b82f640";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(width * 0.5, height * 0.4, 25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(width * 0.5 + 10, height * 0.4);
      ctx.lineTo(width * 0.5 - 5, height * 0.4 - 10);
      ctx.lineTo(width * 0.5 - 5, height * 0.4 + 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 18px Inter";
      ctx.fillText("Your Short is Ready!", width * 0.5 - 80, height * 0.7);

      const downloadGradient = ctx.createLinearGradient(
        width * 0.3,
        height * 0.75,
        width * 0.3,
        height * 0.83
      );
      downloadGradient.addColorStop(0, "#3b82f6");
      downloadGradient.addColorStop(1, "#2563eb");
      ctx.fillStyle = downloadGradient;
      ctx.beginPath();
      ctx.roundRect(width * 0.3, height * 0.75, width * 0.18, height * 0.08, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Inter";
      ctx.fillText("Download", width * 0.33, height * 0.79);

      ctx.fillStyle = themeRef.current === "dark" ? "#334155" : "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(
        width * 0.52,
        height * 0.75,
        width * 0.18,
        height * 0.08,
        8
      );
      ctx.fill();
      ctx.fillStyle = themeRef.current === "dark" ? "#e2e8f0" : "#0f172a";
      ctx.font = "14px Inter";
      ctx.fillText("Create New", width * 0.54, height * 0.79);
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
