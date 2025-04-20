import { useState, useEffect, useCallback, useRef } from "react";
import Logo from "./Logo";
import {
  subscribeToProgress,
  unsubscribeFromProgress,
  getAPIBaseURL,
} from "@/lib/socket";
import axios from "axios";
import { Button } from "./Button";
import { RefreshCw } from "lucide-react";

interface GeneratingAnimationProps {
  duration: number;
  onComplete: () => void;
  videoId?: string;
}

const GeneratingAnimation = ({
  duration,
  onComplete,
  videoId,
}: GeneratingAnimationProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [dots, setDots] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [usingWebSocket, setUsingWebSocket] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const reconnectAttempts = useRef(0);
  // Track last progress value to prevent regression
  const [lastProgress, setLastProgress] = useState(0);

  // Function to safely update progress
  const safeSetProgress = useCallback((newProgress: number) => {
    setLastProgress((prev) => {
      // Only increase progress, never decrease
      const finalProgress = Math.max(prev, newProgress);
      setProgress(finalProgress);
      return finalProgress;
    });
  }, []);

  // Function to check video status directly via API
  const checkVideoStatus = useCallback(async () => {
    if (!videoId) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(
        `${getAPIBaseURL()}/api/video-status/${videoId}`,
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      if (response.data.status === "completed") {
        safeSetProgress(100);
        setIsCompleted(true);
      } else if (response.data.status === "error") {
        setConnectionError(true);
      } else if (response.data.progress) {
        safeSetProgress(response.data.progress);
      }

      // Reset connection error if we got a valid response
      setConnectionError(false);
      reconnectAttempts.current = 0;
    } catch (error) {
      console.error("Error checking video status:", error);
      if (reconnectAttempts.current < 5) {
        reconnectAttempts.current += 1;
      } else {
        setConnectionError(true);
      }
    }
  }, [videoId, safeSetProgress]);

  // Function to manually refresh status
  const handleRefreshStatus = () => {
    checkVideoStatus();
    setConnectionError(false);
    reconnectAttempts.current = 0;
  };

  const generationSteps = [
    { name: "Analyzing prompt", threshold: 10 },
    { name: "Generating content", threshold: 30 },
    { name: "Optimizing script", threshold: 50 },
    { name: "Adding background", threshold: 70 },
    { name: "Applying effects", threshold: 85 },
    { name: "Finalizing", threshold: 95 },
  ];

  // Manage countdown
  useEffect(() => {
    if (isCompleted) {
      onComplete();
      return;
    }

    // Set up countdown timer
    const timer = setTimeout(() => {
      if (timeLeft > 0) {
        setTimeLeft(timeLeft - 1);
      } else {
        // When timer reaches zero, check status via API
        checkVideoStatus();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, isCompleted, onComplete, checkVideoStatus]);

  // Setup polling for status when websocket fails
  useEffect(() => {
    if (connectionError && !pollInterval) {
      const interval = setInterval(checkVideoStatus, 3000);
      setPollInterval(interval);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [connectionError, pollInterval, checkVideoStatus]);

  // Video progress tracking with WebSocket
  useEffect(() => {
    if (videoId) {
      // Also set up a polling fallback in case WebSocket fails
      const fallbackInterval = setInterval(checkVideoStatus, 10000);

      // Keep track of when we last updated the status
      let lastStatusUpdate = Date.now();
      let statusUpdateTimer: NodeJS.Timeout | null = null;
      let statusHistory: number[] = [];
      // OPTIMIZED: Increase debounce time from 100 to 500ms
      const statusDebounceTime = 500;

      // Debounce function to update the current step based on progress
      const updateStatusWithDebounce = (newProgress: number) => {
        // Only add to history if progress has changed by at least 1%
        if (
          statusHistory.length === 0 ||
          Math.abs(statusHistory[statusHistory.length - 1] - newProgress) >= 1
        ) {
          statusHistory.push(newProgress);

          // Keep history manageable
          if (statusHistory.length > 10) {
            statusHistory.shift();
          }
        }

        const now = Date.now();
        const timeSinceLastUpdate = now - lastStatusUpdate;

        if (now - lastStatusUpdate >= statusDebounceTime) {
          if (statusUpdateTimer) {
            clearTimeout(statusUpdateTimer);
            statusUpdateTimer = null;
          }

          // Find the next step based on stable progress
          const nextStep = generationSteps.findIndex(
            (step, index) =>
              newProgress < step.threshold &&
              (index === 0 ||
                newProgress >= generationSteps[index - 1].threshold)
          );

          if (nextStep !== -1 && nextStep !== currentStep) {
            console.log(
              `Updating step to ${nextStep}: ${generationSteps[nextStep].name} at progress ${newProgress}%`
            );
            setCurrentStep(nextStep);
          }

          lastStatusUpdate = now;
        }
        // Schedule a delayed update if we're getting frequent progress updates
        if (!statusUpdateTimer) {
          statusUpdateTimer = setTimeout(() => {
            // Use the latest progress in statusHistory
            const latestProgress =
              statusHistory.length > 0
                ? statusHistory[statusHistory.length - 1]
                : newProgress;

            // Find the next step based on stable progress
            const nextStep = generationSteps.findIndex(
              (step, index) =>
                latestProgress < step.threshold &&
                (index === 0 ||
                  latestProgress >= generationSteps[index - 1].threshold)
            );

            if (nextStep !== -1 && nextStep !== currentStep) {
              console.log(
                `Delayed updating step to ${nextStep}: ${generationSteps[nextStep].name} at progress ${latestProgress}%`
              );
              setCurrentStep(nextStep);
            }

            lastStatusUpdate = Date.now();
            statusUpdateTimer = null;
          }, statusDebounceTime - (now - lastStatusUpdate));
        }
      };

      // Subscribe to progress updates via WebSocket
      subscribeToProgress(videoId, (updatedProgress) => {
        setUsingWebSocket(true);
        setConnectionError(false);
        reconnectAttempts.current = 0;
        safeSetProgress(updatedProgress);

        // Update status with debouncing
        updateStatusWithDebounce(updatedProgress);

        // Complete when progress is 100%
        if (updatedProgress >= 100) {
          setIsCompleted(true);
        }
      });

      // Check initial status immediately
      checkVideoStatus();

      // Cleanup on unmount
      return () => {
        if (statusUpdateTimer) {
          clearTimeout(statusUpdateTimer);
        }
        clearInterval(fallbackInterval);
        unsubscribeFromProgress(videoId);
      };
    }
  }, [
    videoId,
    currentStep,
    generationSteps,
    safeSetProgress,
    checkVideoStatus,
  ]);

  // Update steps based on time-based progress
  useEffect(() => {
    if (usingWebSocket || isCompleted) return;

    const stepTimer = setInterval(() => {
      const progressPercentage = ((duration - timeLeft) / duration) * 100;

      // Find the appropriate step based on progress
      const nextStep = generationSteps.findIndex(
        (step, index) =>
          progressPercentage < step.threshold &&
          (index === 0 ||
            progressPercentage >= generationSteps[index - 1].threshold)
      );

      if (nextStep !== -1 && nextStep !== currentStep) {
        setCurrentStep(nextStep);
      }
    }, 1000);

    return () => clearInterval(stepTimer);
  }, [
    timeLeft,
    currentStep,
    duration,
    usingWebSocket,
    generationSteps,
    isCompleted,
  ]);

  // Animated dots
  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots.length >= 3) return "";
        return prevDots + ".";
      });
    }, 500);

    return () => clearInterval(dotTimer);
  }, []);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="glass-card p-8 animate-scale-in">
          <div className="text-center space-y-8">
            <div className="relative w-40 h-40 mx-auto">
              {/* Outer circle */}
              <div className="absolute inset-0 rounded-full border-4 border-secondary"></div>

              {/* Progress circle - OPTIMIZED: reduce transition duration */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="text-primary transform -rotate-90 origin-center transition-all duration-300"
                  strokeDasharray={`${progress * 2.89}, 289`}
                />
              </svg>

              {/* Spinning logo - OPTIMIZED: reduce animation complexity */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: "spin 8s linear infinite" }}
              >
                <div className="bg-background rounded-full p-2">
                  <Logo size="default" />
                </div>
              </div>

              {/* Progress percentage */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center bg-background/80 rounded-full w-16 h-16 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl font-semibold">
                    {Math.round(progress)}
                  </span>
                  <span className="text-lg">%</span>
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-semibold">
              {progress >= 100
                ? "Complete!"
                : generationSteps[currentStep]?.name}
              {progress < 100 && dots}
            </h3>
            <p className="text-foreground/70">
              {progress >= 100
                ? "Your YouTube Short is ready! Redirecting to gallery..."
                : "Creating your YouTube Short. This process takes a moment."}
            </p>

            {connectionError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-3">
                <p className="text-yellow-800 text-sm mb-2">
                  Connection issue detected. Please wait or try to refresh.
                </p>
                <Button size="sm" onClick={handleRefreshStatus}>
                  <RefreshCw size={14} className="mr-2" />
                  Refresh Status
                </Button>
              </div>
            )}

            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {generationSteps.map((step, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-md border transition-all ${
                    index <= currentStep
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-foreground/60"
                  }`}
                >
                  {index === currentStep && progress < 100 && (
                    <div className="flex items-center space-x-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      <span>{step.name}</span>
                    </div>
                  )}
                  {(index !== currentStep || progress >= 100) && step.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneratingAnimation;
