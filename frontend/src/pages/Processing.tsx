import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getAPIBaseURL, api } from "@/lib/socket";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { motion } from "framer-motion";
import { X, Info } from "lucide-react";
import LazyCreatorLoader from "@/components/LazyCreatorLoader";

const ProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("processing");
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progressStage, setProgressStage] = useState<string>("Initializing");
  const [videoContext, setVideoContext] = useState<{
    prompt: string;
    duration: number;
    backgroundType: string | null;
    customPrompt: boolean;
  } | null>(null);

  // Parse query parameters to get video ID, estimated time, and context
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const duration = params.get("duration");
    const context = params.get("context");

    if (id) {
      setVideoId(id);
      setStartTime(new Date());
    } else {
      toast.error("No video ID provided");
      navigate("/create");
    }

    if (duration) {
      setEstimatedTime(parseInt(duration));
    }

    if (context) {
      try {
        const contextData = JSON.parse(decodeURIComponent(context));
        setVideoContext(contextData);
      } catch (error) {
        console.error("Error parsing video context:", error);
      }
    }
  }, [location.search, navigate]);

  // Update elapsed time every second
  useEffect(() => {
    if (!startTime || status !== "processing") return;

    const timer = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, status]);

  // Function to determine progress stage based on progress percentage
  const updateProgressStage = useCallback((progress: number) => {
    if (progress < 10) {
      setProgressStage("Initializing");
    } else if (progress < 30) {
      setProgressStage("Generating script");
    } else if (progress < 50) {
      setProgressStage("Creating visuals");
    } else if (progress < 70) {
      setProgressStage("Rendering video");
    } else if (progress < 90) {
      setProgressStage("Finalizing");
    } else {
      setProgressStage("Uploading");
    }
  }, []);

  // Poll for video status
  useEffect(() => {
    if (!videoId || !isAuthenticated) return;

    const checkStatus = async () => {
      try {
        const response = await api.get(`/api/video-status/${videoId}`);

        if (response.data) {
          const { status: videoStatus, progress: videoProgress } =
            response.data;
          setStatus(videoStatus);
          setProgress(videoProgress);
          updateProgressStage(videoProgress);

          // If video is completed or has an error, redirect or show message
          if (videoStatus === "completed") {
            toast.success("Video generation completed!");
            // Clear the in-progress flag
            localStorage.removeItem("videoCreationInProgress");
            // Redirect to gallery
            setTimeout(() => navigate("/gallery"), 1500);
          } else if (videoStatus === "error") {
            toast.error("An error occurred during video generation");
            // Clear the in-progress flag
            localStorage.removeItem("videoCreationInProgress");
            // Stay on page but allow user to go back
          } else if (videoStatus === "cancelled") {
            toast.info("Video generation was cancelled");
            // Clear the in-progress flag
            localStorage.removeItem("videoCreationInProgress");
            // Redirect to create page
            setTimeout(() => navigate("/create"), 1500);
          }
        }
      } catch (error) {
        console.error("Error checking video status:", error);
      }
    };

    // Initial check
    checkStatus();

    // Set up polling interval (every 3 seconds)
    const interval = setInterval(checkStatus, 3000);

    return () => clearInterval(interval);
  }, [videoId, isAuthenticated, navigate, updateProgressStage]);

  // Handle cancel button click
  const handleCancel = async () => {
    if (!videoId || isCancelling) return;

    setIsCancelling(true);
    try {
      const response = await api.post(`/api/cancel-video/${videoId}`);
      if (response.data.status === "success") {
        toast.success("Video generation cancelled");
        setStatus("cancelled");
        // Clear the in-progress flag
        localStorage.removeItem("videoCreationInProgress");
        // Redirect to create page
        setTimeout(() => navigate("/create"), 1500);
      } else {
        throw new Error(
          response.data.message || "Failed to cancel video generation"
        );
      }
    } catch (error) {
      console.error("Error cancelling video:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to cancel video generation"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Format time (seconds) to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Calculate remaining time
  const getRemainingTime = (): string => {
    if (!estimatedTime || !startTime) return "Calculating...";

    const elapsed = elapsedTime;
    const remaining = Math.max(0, estimatedTime - elapsed);

    return formatTime(remaining);
  };

  // Redirect to create page if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast.error("You need to be logged in");
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  // Redirect to create page if user refreshes and no video is in progress
  useEffect(() => {
    const inProgress = localStorage.getItem("videoCreationInProgress");
    if (!inProgress && !videoId) {
      navigate("/create");
    }
  }, [videoId, navigate]);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden text-foreground">
      {/* Background with brand styling */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br dark:from-[#800000]/10 dark:via-[#722F37]/5 dark:to-[#0A0A0A] light:from-[#FFF5F5]/70 light:via-[#FFF0F0]/80 light:to-white"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-full max-w-3xl aspect-[3/1] bg-[#E0115F]/5 rounded-full blur-[100px] opacity-20 animate-breathe"></div>
          <div className="absolute bottom-1/4 left-1/4 w-full max-w-2xl aspect-[3/1] bg-[#800000]/10 rounded-full blur-[120px] opacity-10 animate-breathe delay-700"></div>
        </div>
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#E0115F_1px,transparent_1px)] [background-size:24px_24px]"></div>
        </div>
      </div>

      <Navbar />

      <main className="flex-grow relative pt-24 md:pt-32 pb-16">
        <div className="container max-w-3xl mx-auto px-4 md:px-6 relative z-10">
          <div className="text-left md:text-center mb-10">
            <div className="inline-block px-4 py-1 mb-4 text-sm font-medium text-[#E0115F] bg-[#E0115F]/10 dark:bg-[#E0115F]/5 border border-[#E0115F]/20 rounded-full">
              Processing Your Video
            </div>
            <h1 className="text-3xl md:text-4xl font-bold dark:text-white light:text-gray-800 mb-4 leading-tight">
              Creating Your YouTube Short
              <span className="text-[#E0115F]">.</span>
            </h1>
            <p className="text-base md:text-lg dark:text-gray-400 light:text-gray-600 max-w-2xl mx-auto">
              Sit back and relax while we generate your video. This process may
              take a few minutes.
            </p>
          </div>

          <Card className="overflow-hidden border border-[#E0115F]/20 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center space-y-8">
                {/* Video Context Card */}
                {videoContext && (
                  <div className="w-full p-4 bg-card/80 border border-[#E0115F]/20 rounded-lg mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Info size={18} className="text-[#E0115F]" />
                      <h3 className="font-medium">Short Details</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium">Content:</span> {videoContext.prompt.length > 80 
                          ? `${videoContext.prompt.substring(0, 80)}...` 
                          : videoContext.prompt}
                      </p>
                      <p><span className="font-medium">Duration:</span> {videoContext.duration} seconds</p>
                      {videoContext.backgroundType && (
                        <p><span className="font-medium">Background:</span> {videoContext.backgroundType}</p>
                      )}
                      <p><span className="font-medium">Type:</span> {videoContext.customPrompt ? 'Custom content' : 'Template content'}</p>
                    </div>
                  </div>
                )}
                
                {/* Branded Loader */}
                <LazyCreatorLoader progress={progress} />

                {/* Progress Information */}
                <div className="w-full space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{progressStage}</span>
                    <span className="text-sm font-medium">{progress}%</span>
                  </div>

                  <Progress value={progress} className="h-2 w-full" />

                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Elapsed: {formatTime(elapsedTime)}</span>
                    <span>Remaining: {getRemainingTime()}</span>
                  </div>
                </div>

                {/* Cancel Button */}
                <Button
                  variant="outline"
                  className="border-[#E0115F]/30 text-[#E0115F] hover:bg-[#E0115F]/10"
                  onClick={handleCancel}
                  disabled={isCancelling || status !== "processing"}
                >
                  {isCancelling ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Cancel Generation
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProcessingPage;
