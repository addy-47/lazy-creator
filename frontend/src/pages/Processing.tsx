import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { videoApi } from "@/services/apis";
import { PollingService } from "@/services/pollingService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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

  // Polling for status
  useEffect(() => {
    if (!videoId || !isAuthenticated) return;

    // Use PollingService instead of WebSocket
    PollingService.startPolling(videoId, {
      onUpdate: (data) => {
        if (data.progress !== undefined) setProgress(data.progress || 0);
        if (data.status_message) setProgressStage(data.status_message);
        if (data.estimated_time !== undefined) setEstimatedTime(data.estimated_time);
        if (data.status) setStatus(data.status);
      },
      onSuccess: () => {
        toast.success("Video generation completed!");
        localStorage.removeItem("videoCreationInProgress");
        setTimeout(() => navigate("/gallery"), 1500);
      },
      onError: (error) => {
        setStatus("error");
        toast.error(error.message || "Generation failed");
        localStorage.removeItem("videoCreationInProgress");
      }
    });

    return () => {
      PollingService.stopPolling(videoId);
    };
  }, [videoId, isAuthenticated, navigate]);

  // Handle cancel button click
  const handleCancel = async () => {
    if (!videoId || isCancelling) return;

    setIsCancelling(true);
    try {
      const response = await videoApi.cancel(videoId);
      if (response.data.status === "success" || response.status === 200) {
        toast.success("Video generation cancelled");
        setStatus("cancelled");
        localStorage.removeItem("videoCreationInProgress");
        setTimeout(() => navigate("/create"), 1500);
      } else {
        throw new Error(response.data.message || "Failed to cancel");
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

      <Navbar disableNavigation={true} />

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
