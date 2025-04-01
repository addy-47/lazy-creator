import { useState, useEffect, useCallback } from "react";
import Logo from "./Logo";
import {
  subscribeToProgress,
  unsubscribeFromProgress,
  getAPIBaseURL,
} from "@/lib/socket";
import axios from "axios";

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

  const generationSteps = [
    { name: "Analyzing prompt", threshold: 10 },
    { name: "Generating content", threshold: 30 },
    { name: "Optimizing script", threshold: 50 },
    { name: "Adding background", threshold: 70 },
    { name: "Applying effects", threshold: 85 },
    { name: "Finalizing", threshold: 95 },
  ];

  // Function to check video status directly from the API
  const checkVideoStatus = useCallback(async () => {
    if (!videoId) return;

    try {
      // Get authentication token
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("Authentication token missing");
        return false;
      }

      const response = await axios.get(
        `${getAPIBaseURL()}/api/video-status/${videoId}`,
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      if (response.data.status === "completed") {
        // Video is complete, trigger completion
        setProgress(100);
        setIsCompleted(true);
        return true;
      } else if (response.data.progress) {
        // Update progress
        setProgress(response.data.progress);
      }
      return false;
    } catch (error) {
      console.error("Error checking video status:", error);
      return false;
    }
  }, [videoId]);

  // Set up polling for completion status as a fallback
  useEffect(() => {
    if (isCompleted || !videoId) return;

    // Start polling for video status
    const interval = setInterval(async () => {
      const isComplete = await checkVideoStatus();
      if (isComplete) {
        // Clear interval if complete
        clearInterval(interval);
        if (!isCompleted) {
          setIsCompleted(true);
        }
      }
    }, 3000); // Check every 3 seconds

    setPollInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoId, isCompleted, checkVideoStatus]);

  // Connect to WebSocket for progress updates if videoId is provided
  useEffect(() => {
    if (videoId) {
      // Subscribe to progress updates via WebSocket
      subscribeToProgress(videoId, (updatedProgress) => {
        setProgress(updatedProgress);
        setUsingWebSocket(true);

        // Update current step based on progress
        const nextStep = generationSteps.findIndex(
          (step, index) =>
            updatedProgress < step.threshold &&
            (index === 0 ||
              updatedProgress >= generationSteps[index - 1].threshold)
        );

        if (nextStep !== -1 && nextStep !== currentStep) {
          setCurrentStep(nextStep);
        }

        // Complete when progress is 100%
        if (updatedProgress >= 100) {
          setIsCompleted(true);
        }
      });

      // Cleanup on unmount
      return () => {
        unsubscribeFromProgress(videoId);
      };
    }
  }, [videoId, currentStep, generationSteps]);

  // Effect to trigger onComplete when isCompleted changes
  useEffect(() => {
    if (isCompleted) {
      // Wait a moment to allow UI to show 100% before redirecting
      const completeTimer = setTimeout(() => {
        onComplete();
      }, 1500);

      return () => clearTimeout(completeTimer);
    }
  }, [isCompleted, onComplete]);

  // Fallback timer-based progress when WebSocket is not available
  useEffect(() => {
    if (usingWebSocket || !duration || isCompleted) return;

    if (timeLeft <= 0) {
      // Check one last time for completion status
      checkVideoStatus().then((isComplete) => {
        if (!isComplete) {
          // If not complete yet, show 99% but don't redirect
          setProgress(99);
        }
      });
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
      // Calculate progress as a percentage of elapsed time - max out at 95% for timer-based updates
      const elapsedTime = duration - timeLeft + 1;
      const calculatedProgress = Math.min(95, (elapsedTime / duration) * 100);
      setProgress(calculatedProgress);
    }, 1000);

    return () => clearInterval(timer);
  }, [
    timeLeft,
    onComplete,
    duration,
    usingWebSocket,
    isCompleted,
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

              {/* Progress circle */}
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
                  className="text-primary transform -rotate-90 origin-center transition-all duration-1000"
                  strokeDasharray={`${progress * 2.89}, 289`}
                />
              </svg>

              {/* Spinning logo */}
              <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
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

            <div className="space-y-2">
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
            </div>

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
