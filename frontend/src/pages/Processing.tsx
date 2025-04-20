import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import GeneratingAnimation from "@/components/Loader";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";
import { Button } from "@/components/Button";
import { X } from "lucide-react";

const Processing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(120);
  const [isConfirmedComplete, setIsConfirmedComplete] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    // Parse query parameters to get video ID and duration
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const durationParam = params.get("duration");

    if (id) {
      setVideoId(id);
    } else {
      // If no video ID, redirect back to create page
      navigate("/create");
    }

    if (durationParam) {
      setDuration(parseInt(durationParam, 10));
    }

    // Prevent navigation away from this page during video generation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only prevent navigation if generation is not confirmed complete
      if (!isConfirmedComplete) {
        e.preventDefault();
        e.returnValue =
          "Your video is still being created. Are you sure you want to leave?";
        return "Your video is still being created. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Show a toast notification explaining to the user that they need to wait
    toast.info(
      "Please wait while your short is being created. Do not navigate away from this page.",
      {
        duration: 6000,
      }
    );

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [location.search, navigate, isConfirmedComplete]);

  // Function to double-check completion status before navigating
  const verifyCompletion = async (videoId: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return false;

      const response = await axios.get(
        `${getAPIBaseURL()}/api/video-status/${videoId}`,
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      return response.data.status === "completed";
    } catch (error) {
      console.error("Error verifying completion:", error);
      return false;
    }
  };

  // Function to handle completion
  const handleComplete = async () => {
    if (!videoId) {
      navigate("/gallery");
      return;
    }

    // Double-check completion status before navigating
    const isComplete = await verifyCompletion(videoId);

    if (isComplete) {
      // Remove any navigation prevention since we're done
      setIsConfirmedComplete(true);
      localStorage.removeItem("videoCreationInProgress");
      toast.success("Your short has been created successfully!");
      navigate("/gallery");
    } else {
      // If completion check fails, wait a bit longer and try again
      toast.info("Finalizing your video, please wait...");
      setTimeout(async () => {
        const secondCheck = await verifyCompletion(videoId);
        if (secondCheck) {
          setIsConfirmedComplete(true);
          localStorage.removeItem("videoCreationInProgress");
          toast.success("Your short has been created successfully!");
          navigate("/gallery");
        } else {
          // If still not complete, send to gallery anyway but with a warning
          toast.warning(
            "Video may still be processing. Check the gallery later."
          );
          setIsConfirmedComplete(true);
          navigate("/gallery");
        }
      }, 3000);
    }
  };

  // Function to cancel video creation process
  const handleCancelCreation = async () => {
    if (!videoId || isCancelling) return;

    setIsCancelling(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const confirmCancel = window.confirm(
        "Are you sure you want to cancel video creation? This action cannot be undone."
      );

      if (!confirmCancel) {
        setIsCancelling(false);
        return;
      }

      toast.loading("Cancelling video creation...");

      const response = await axios.post(
        `${getAPIBaseURL()}/api/cancel-video/${videoId}`,
        {},
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      if (response.data.status === "success") {
        setIsConfirmedComplete(true);
        localStorage.removeItem("videoCreationInProgress");
        toast.success("Video creation cancelled");
        navigate("/create");
      } else {
        throw new Error("Failed to cancel video creation");
      }
    } catch (error) {
      console.error("Error cancelling video:", error);
      toast.error("Failed to cancel video creation");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>

      <Navbar />
      <main className="flex-grow pt-32 pb-20 px-4">
        {videoId && (
          <>
            <div className="absolute top-4 right-4 z-50">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelCreation}
                disabled={isCancelling || isConfirmedComplete}
                className="flex items-center gap-1"
              >
                <X size={16} />
                Cancel
              </Button>
            </div>
            <GeneratingAnimation
              duration={duration}
              onComplete={handleComplete}
              videoId={videoId}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default Processing;
