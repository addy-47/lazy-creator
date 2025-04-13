import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import GeneratingAnimation from "@/components/Loader";
import Navbar from "@/components/Navbar";
import { useContext } from "react";
import { AuthContext } from "../App";
import { toast } from "sonner";

const Processing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { username } = useContext(AuthContext);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(120);

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
      e.preventDefault();
      e.returnValue =
        "Your video is still being created. Are you sure you want to leave?";
      return "Your video is still being created. Are you sure you want to leave?";
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
  }, [location.search, navigate]);

  // Function to handle completion
  const handleComplete = () => {
    // Remove any navigation prevention since we're done
    toast.success("Your short has been created successfully!");
    navigate("/gallery");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>

      <Navbar username={username} />
      <main className="flex-grow pt-32 pb-20 px-4">
        {videoId && (
          <GeneratingAnimation
            duration={duration}
            onComplete={handleComplete}
            videoId={videoId}
          />
        )}
      </main>
    </div>
  );
};

export default Processing;
