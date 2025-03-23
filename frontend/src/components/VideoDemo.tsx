
import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";

const VideoDemo = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Determine dark mode from theme
  const isDarkMode = resolvedTheme === 'dark';
  
  // After mounting, we can access the theme
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    if (!mounted) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let animationFrame: number;
    let step = 0;
    const totalSteps = 600; // 10 seconds at 60fps
    
    const drawDemoFrame = () => {
      if (!ctx || !canvas) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background (respect dark mode)
      ctx.fillStyle = isDarkMode ? "#111827" : "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Demo app interface
      drawInterface(ctx, canvas, step);
      
      // Progress animation
      step = (step + 1) % totalSteps;
      
      animationFrame = requestAnimationFrame(drawDemoFrame);
    };
    
    const drawInterface = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, currentStep: number) => {
      const width = canvas.width;
      const height = canvas.height;
      
      // Draw app frame with glass effect
      ctx.fillStyle = isDarkMode ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.8)";
      ctx.beginPath();
      ctx.roundRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8, 20);
      ctx.fill();
      
      ctx.strokeStyle = isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Add glassmorphism shine
      const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.1);
      gradient.addColorStop(0, isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.7)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(width * 0.1, height * 0.1, width * 0.8, height * 0.05, [20, 20, 0, 0]);
      ctx.fill();
      
      // Animation phase based on current step
      const phase = Math.floor(currentStep / 150) % 4;
      
      if (phase === 0) {
        // Draw prompt selection
        drawPromptSelection(ctx, width, height, currentStep % 150);
      } else if (phase === 1) {
        // Draw duration slider
        drawDurationSlider(ctx, width, height, currentStep % 150);
      } else if (phase === 2) {
        // Draw background selection
        drawBackgroundSelection(ctx, width, height, currentStep % 150);
      } else {
        // Draw video generation
        drawVideoGeneration(ctx, width, height, currentStep % 150);
      }
      
      // Add stick figure mascot based on the phase
      drawStickFigure(ctx, width, height, currentStep, phase);
    };
    
    const drawStickFigure = (ctx: CanvasRenderingContext2D, width: number, height: number, step: number, phase: number) => {
      // Position stick figure based on phase
      let x = width * 0.9;
      let y = height * 0.85;
      
      if (phase === 0) {
        // Peeking from bottom right
        x = width * 0.85;
        y = height * 0.85 - ((step % 150) < 30 ? (step % 30) * 2 : 60);
      } else if (phase === 1) {
        // Moving across the bottom
        x = width * (0.85 - ((step % 150) / 150) * 0.7);
        y = height * 0.85;
      } else if (phase === 2) {
        // Jumping at bottom left
        x = width * 0.15;
        y = height * (0.85 - Math.sin((step % 150) / 25) * 0.1);
      } else {
        // Spinning near the generated video
        x = width * 0.8;
        y = height * 0.5;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((step % 150) / 150) * Math.PI * 2);
        ctx.translate(-x, -y);
      }
      
      const primaryColor = isDarkMode ? "#3B82F6" : "#2563EB";
      
      // Draw stick figure
      // Head
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(x, y - 15, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Body
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
      
      // Arms
      if (phase === 0 || phase === 3) {
        // Waving arm for phases 0 and 3
        const waveAngle = Math.sin((step % 150) / 15) * 0.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x + Math.cos(waveAngle) * 12, y - 7 - Math.sin(waveAngle) * 12);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x - 8, y - 7);
        ctx.stroke();
      } else {
        // Regular arms
        ctx.beginPath();
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x + 8, y - 7);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x - 8, y - 7);
        ctx.stroke();
      }
      
      // Legs
      if (phase === 2) {
        // Jump legs
        const legAngle = Math.sin((step % 150) / 25) * 0.3;
        ctx.beginPath();
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x + Math.sin(legAngle) * 10, y + 15 + Math.cos(legAngle) * 3);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x - Math.sin(legAngle) * 10, y + 15 + Math.cos(legAngle) * 3);
        ctx.stroke();
      } else {
        // Regular legs
        ctx.beginPath();
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x + 6, y + 15);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x - 6, y + 15);
        ctx.stroke();
      }
      
      // Add Zzz for phase 0
      if (phase === 0 && (step % 150) > 50) {
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y - 20);
        ctx.lineTo(x + 15, y - 25);
        ctx.lineTo(x + 8, y - 25);
        ctx.lineTo(x + 13, y - 30);
        ctx.stroke();
      }
      
      if (phase === 3) {
        ctx.restore();
      }
    };
    
    const drawPromptSelection = (ctx: CanvasRenderingContext2D, width: number, height: number, step: number) => {
      // Title
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 16px Inter";
      ctx.fillText("Select a Prompt", width * 0.15, height * 0.2);
      
      // Draw prompt buttons with modern design
      const promptColors = [
        isDarkMode ? "#3b82f6" : "#3b82f6", 
        isDarkMode ? "#334155" : "#e2e8f0", 
        isDarkMode ? "#334155" : "#e2e8f0", 
        isDarkMode ? "#334155" : "#e2e8f0"
      ];
      
      for (let i = 0; i < 4; i++) {
        // Button background
        ctx.fillStyle = promptColors[i];
        ctx.beginPath();
        ctx.roundRect(width * (0.15 + i * 0.15), height * 0.25, width * 0.12, height * 0.08, 20);
        ctx.fill();
        
        // Button border
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Button text
        ctx.fillStyle = i === 0 ? "#ffffff" : (isDarkMode ? "#e2e8f0" : "#0f172a");
        ctx.font = "12px Inter";
        ctx.fillText(`Prompt ${i+1}`, width * (0.15 + i * 0.15) + 10, height * 0.25 + 20);
      }
      
      // Selection indicator with animation
      const progress = Math.min(1, step / 100);
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = "14px Inter";
      ctx.fillText("Prompt Selected", width * 0.15, height * 0.4);
      
      // Loading indicator
      if (step > 100) {
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 14px Inter";
        ctx.fillText("✓", width * 0.35, height * 0.4);
      }
    };
    
    const drawDurationSlider = (ctx: CanvasRenderingContext2D, width: number, height: number, step: number) => {
      // Title
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 16px Inter";
      ctx.fillText("Select Duration", width * 0.15, height * 0.2);
      
      // Draw slider track
      ctx.fillStyle = isDarkMode ? "#334155" : "#e2e8f0";
      ctx.beginPath();
      ctx.roundRect(width * 0.15, height * 0.3, width * 0.7, height * 0.05, 10);
      ctx.fill();
      
      // Draw slider progress
      const sliderProgress = Math.min(0.7, Math.max(0, (step / 150) * 0.7));
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.roundRect(width * 0.15, height * 0.3, width * sliderProgress, height * 0.05, 10);
      ctx.fill();
      
      // Slider handle with glow effect
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(width * (0.15 + sliderProgress), height * 0.325, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Handle shadow
      ctx.shadowColor = "#3b82f6";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(width * (0.15 + sliderProgress), height * 0.325, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Duration indicator
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = "14px Inter";
      ctx.fillText(`${Math.round((sliderProgress / 0.7) * 20 + 10)}s`, width * (0.15 + sliderProgress), height * 0.4);
      
      // Complete indicator
      if (step > 120) {
        ctx.fillStyle = "#22c55e";
        ctx.font = "bold 14px Inter";
        ctx.fillText("Duration Selected ✓", width * 0.15, height * 0.5);
      }
    };
    
    const drawBackgroundSelection = (ctx: CanvasRenderingContext2D, width: number, height: number, step: number) => {
      // Title
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = "bold 16px Inter";
      ctx.fillText("Select Background", width * 0.15, height * 0.2);
      
      // Background type options
      ctx.fillStyle = step < 70 ? "#3b82f6" : (isDarkMode ? "#334155" : "#e2e8f0");
      ctx.beginPath();
      ctx.roundRect(width * 0.15, height * 0.25, width * 0.2, height * 0.1, 10);
      ctx.fill();
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = "14px Inter";
      ctx.fillText("Image", width * 0.21, height * 0.3);
      
      ctx.fillStyle = step >= 70 ? "#3b82f6" : (isDarkMode ? "#334155" : "#e2e8f0");
      ctx.beginPath();
      ctx.roundRect(width * 0.4, height * 0.25, width * 0.2, height * 0.1, 10);
      ctx.fill();
      ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
      ctx.font = "14px Inter";
      ctx.fillText("Video", width * 0.46, height * 0.3);
      
      // Source options
      if (step > 90) {
        ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
        ctx.font = "bold 14px Inter";
        ctx.fillText("Source:", width * 0.15, height * 0.45);
        
        ctx.fillStyle = step < 120 ? "#3b82f6" : (isDarkMode ? "#334155" : "#e2e8f0");
        ctx.beginPath();
        ctx.roundRect(width * 0.15, height * 0.5, width * 0.25, height * 0.08, 10);
        ctx.fill();
        ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
        ctx.font = "14px Inter";
        ctx.fillText("Use our library", width * 0.19, height * 0.55);
        
        ctx.fillStyle = step >= 120 ? "#3b82f6" : (isDarkMode ? "#334155" : "#e2e8f0");
        ctx.beginPath();
        ctx.roundRect(width * 0.45, height * 0.5, width * 0.25, height * 0.08, 10);
        ctx.fill();
        ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
        ctx.font = "14px Inter";
        ctx.fillText("Upload your own", width * 0.49, height * 0.55);
      }
    };
    
    const drawVideoGeneration = (ctx: CanvasRenderingContext2D, width: number, height: number, step: number) => {
      // Create button & click effect
      if (step < 30) {
        // Modern gradient button
        const gradient = ctx.createLinearGradient(width * 0.3, height * 0.7, width * 0.7, height * 0.8);
        gradient.addColorStop(0, "#3b82f6");
        gradient.addColorStop(1, "#2563eb");
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.roundRect(width * 0.3, height * 0.7, width * 0.4, height * 0.1, 10);
        ctx.fill();
        
        // Button glow
        ctx.shadowColor = "#3b82f680";
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px Inter";
        ctx.fillText("Create Short", width * 0.42, height * 0.76);
        
        if (step > 15) {
          // Click effect
          ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
          ctx.beginPath();
          ctx.arc(width * 0.5, height * 0.75, (step - 15) * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (step <= 120) {
        // Generation progress with more appealing visuals
        const progress = (step - 30) / 90;
        
        // Processing overlay
        ctx.fillStyle = isDarkMode ? "rgba(17, 24, 39, 0.9)" : "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
        
        // Spinner with glowing effect
        const spinnerRadius = Math.min(width, height) * 0.1;
        const spinnerCenterX = width * 0.5;
        const spinnerCenterY = height * 0.3;
        
        // Outer circle
        ctx.strokeStyle = isDarkMode ? "#334155" : "#e2e8f0";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(spinnerCenterX, spinnerCenterY, spinnerRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Progress arc with glow
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
          -Math.PI / 2 + (progress * Math.PI * 2)
        );
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Countdown text
        ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
        ctx.font = "bold 20px Inter";
        const timeLeft = Math.ceil(30 - progress * 30);
        ctx.fillText(`${timeLeft}s`, spinnerCenterX - 15, spinnerCenterY + 7);
        
        // Status text with subtle animation
        ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
        ctx.font = "bold 18px Inter";
        ctx.fillText("Generating your Short...", width * 0.5 - 100, height * 0.5);
        
        // Progress bar with gradient
        ctx.fillStyle = isDarkMode ? "#334155" : "#e2e8f0";
        ctx.beginPath();
        ctx.roundRect(width * 0.25, height * 0.6, width * 0.5, height * 0.03, 5);
        ctx.fill();
        
        const barGradient = ctx.createLinearGradient(width * 0.25, 0, width * 0.75, 0);
        barGradient.addColorStop(0, "#3b82f6");
        barGradient.addColorStop(1, "#2563eb");
        ctx.fillStyle = barGradient;
        
        ctx.beginPath();
        ctx.roundRect(width * 0.25, height * 0.6, width * 0.5 * progress, height * 0.03, 5);
        ctx.fill();
        
        // Status steps with better visibility
        const steps = ["Analyzing prompt", "Generating content", "Adding background", "Finalizing"];
        const stepActive = Math.floor(progress * 4);
        
        for (let i = 0; i < steps.length; i++) {
          if (i <= stepActive) {
            ctx.fillStyle = i === stepActive ? "#3b82f6" : (isDarkMode ? "#e2e8f0" : "#0f172a");
            ctx.font = i === stepActive ? "bold 14px Inter" : "14px Inter";
          } else {
            ctx.fillStyle = isDarkMode ? "#64748b" : "#9ca3af";
            ctx.font = "14px Inter";
          }
          ctx.fillText(steps[i], width * (0.25 + i * 0.17), height * 0.7);
        }
      } else {
        // Completed video with more appealing UI
        // Video placeholder with slight gradient
        const videoGradient = ctx.createLinearGradient(0, height * 0.2, 0, height * 0.6);
        videoGradient.addColorStop(0, isDarkMode ? "#1e293b" : "#0f172a");
        videoGradient.addColorStop(1, isDarkMode ? "#0f172a" : "#1e293b");
        
        ctx.fillStyle = videoGradient;
        ctx.beginPath();
        ctx.roundRect(width * 0.2, height * 0.2, width * 0.6, height * 0.4, 10);
        ctx.fill();
        
        // Video border glow
        ctx.strokeStyle = "#3b82f640";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Play button with hover effect
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
        
        // Success message with animation
        ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
        ctx.font = "bold 18px Inter";
        ctx.fillText("Your Short is Ready!", width * 0.5 - 80, height * 0.7);
        
        // Action buttons with modern design
        // Download button
        const downloadGradient = ctx.createLinearGradient(width * 0.3, height * 0.75, width * 0.3, height * 0.83);
        downloadGradient.addColorStop(0, "#3b82f6");
        downloadGradient.addColorStop(1, "#2563eb");
        ctx.fillStyle = downloadGradient;
        ctx.beginPath();
        ctx.roundRect(width * 0.3, height * 0.75, width * 0.18, height * 0.08, 8);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "14px Inter";
        ctx.fillText("Download", width * 0.33, height * 0.79);
        
        // Create New button
        ctx.fillStyle = isDarkMode ? "#334155" : "#e2e8f0";
        ctx.beginPath();
        ctx.roundRect(width * 0.52, height * 0.75, width * 0.18, height * 0.08, 8);
        ctx.fill();
        ctx.fillStyle = isDarkMode ? "#e2e8f0" : "#0f172a";
        ctx.font = "14px Inter";
        ctx.fillText("Create New", width * 0.54, height * 0.79);
      }
    };
    
    drawDemoFrame();
    
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [isDarkMode, mounted]); // Re-run effect when theme changes
  
  if (!mounted) {
    // Return a placeholder or loading state
    return (
      <div className="w-full h-[450px] rounded-lg bg-muted animate-pulse" />
    );
  }
  
  return (
    <canvas 
      ref={canvasRef} 
      width={800} 
      height={450} 
      className="w-full h-full rounded-lg shadow-md bg-background"
    />
  );
};

export default VideoDemo;
