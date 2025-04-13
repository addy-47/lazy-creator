import { useState, useEffect } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "./Button";
import PromptSelector from "./PromptSelector";
import DurationSlider from "./DurationSlider";
import BackgroundSelector from "./BackgroundSelector";
import { toast } from "sonner";
import { getAPIBaseURL } from "@/lib/socket";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

const CreateForm = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(20);
  const [backgroundType, setBackgroundType] = useState<
    "image" | "video" | null
  >(null);
  const [backgroundSource, setBackgroundSource] = useState<
    "custom" | "provided" | null
  >(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [videoData, setVideoData] = useState<{
    filename: string;
    path: string;
    id: string;
  } | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
  };

  const handleDurationChange = (value: number) => {
    setDuration(value);
  };

  const handleBackgroundTypeChange = (type: "image" | "video" | null) => {
    setBackgroundType(type);
  };

  const handleBackgroundSourceChange = (
    source: "custom" | "provided" | null
  ) => {
    setBackgroundSource(source);
  };

  const handleBackgroundFileChange = (file: File | null) => {
    setBackgroundFile(file);
  };

  // Cleanup poll interval on component unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt) {
      toast.error("Please select or write a prompt");
      return;
    }

    if (!backgroundType || !backgroundSource) {
      toast.error("Please select a background type and source");
      return;
    }

    if (backgroundSource === "custom" && !backgroundFile) {
      toast.error(
        "Please upload a background file or choose 'Use our library'"
      );
      return;
    }

    // Show confirmation dialog instead of starting generation immediately
    setShowConfirmDialog(true);
  };

  const startGeneration = async () => {
    setShowConfirmDialog(false);
    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("duration", duration.toString());
      formData.append("background_type", backgroundType || "");
      formData.append("background_source", backgroundSource || "");

      if (backgroundFile) {
        formData.append("background_file", backgroundFile);
      }

      // Get authentication token
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error(
          "You need to be logged in to create videos. Please log in and try again."
        );
        setIsGenerating(false);
        navigate("/auth");
        return;
      }

      // Start the video generation process with authentication
      const response = await fetch(`${getAPIBaseURL()}/api/generate-short`, {
        method: "POST",
        body: formData,
        headers: {
          "x-access-token": token,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate video");
      }

      const data = await response.json();
      console.log("Generation started:", data);

      if (data.status === "processing") {
        // Set flag that video creation is in progress
        localStorage.setItem("videoCreationInProgress", "true");

        // Show toast notification that the process has started
        toast.success(
          "Video creation started! You'll be redirected to the processing page."
        );

        // Navigate to processing page with video ID
        navigate(`/processing?id=${data.video_id}&duration=${duration * 6}`);
      } else {
        throw new Error(data.message || "Failed to start video generation");
      }
    } catch (error) {
      console.error("Error generating video:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate video"
      );
      setIsGenerating(false);
    }
  };

  const handleGenerationComplete = () => {
    // Ensure the video data is available
    if (!videoData) {
      toast.info(
        "Video processing may still be in progress. Check the gallery later."
      );
    }

    // Clear any polling intervals
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }

    // Navigate to gallery
    navigateToGallery();
  };

  const navigateToGallery = () => {
    setIsGenerating(false);
    setIsGenerated(true);

    toast.success("Video generated successfully!");

    // Redirect to gallery page to see the video
    setTimeout(() => {
      navigate("/gallery");
    }, 500);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Remove the GeneratingAnimation since we're redirecting to Processing page */}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ready to create your Short?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a YouTube Short based on your current settings.
              The process may take several minutes depending on video length.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startGeneration}>
              Generate Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isGenerated ? (
        <div className="glass-card p-8 animate-scale-in">
          <div className="text-center space-y-6">
            <div className="inline-block p-4 rounded-full bg-primary/20 mb-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>

            <h2 className="text-2xl font-medium">Your Short is Ready!</h2>

            <div className="aspect-[9/16] max-w-[280px] mx-auto rounded-lg overflow-hidden bg-black flex items-center justify-center">
              {videoData ? (
                <video
                  src={`${getAPIBaseURL()}/api/gallery/${
                    videoData.filename
                  }?token=${encodeURIComponent(
                    localStorage.getItem("token") || ""
                  )}`}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <p className="text-foreground/70">
                  Video is still processing. Check the gallery.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              {videoData && (
                <Button
                  onClick={async () => {
                    try {
                      // Get authentication token
                      const token = localStorage.getItem("token");
                      if (!token) {
                        toast.error("Authentication required to download");
                        return;
                      }

                      // Use the download API which handles authentication
                      const response = await fetch(
                        `${getAPIBaseURL()}/api/download/${videoData.id}`,
                        {
                          headers: {
                            "x-access-token": token,
                          },
                        }
                      );

                      if (!response.ok) {
                        throw new Error("Failed to download video");
                      }

                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);

                      // Create download link
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = videoData.filename;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      URL.revokeObjectURL(url);

                      toast.success("Download started!");
                    } catch (error) {
                      console.error("Download error:", error);
                      toast.error("Failed to download video");
                    }
                  }}
                >
                  Download
                </Button>
              )}
              <Button onClick={navigateToGallery}>Go to Gallery</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsGenerated(false);
                  setPrompt("");
                  setDuration(20);
                  setBackgroundType(null);
                  setBackgroundSource(null);
                  setBackgroundFile(null);
                  setVideoData(null);
                }}
              >
                Create Another
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <PromptSelector
            selectedPrompt={prompt}
            onPromptChange={handlePromptChange}
          />

          <DurationSlider
            selectedDuration={duration}
            onDurationChange={handleDurationChange}
          />

          <BackgroundSelector
            selectedType={backgroundType}
            selectedSource={backgroundSource}
            customFile={backgroundFile}
            onTypeChange={handleBackgroundTypeChange}
            onSourceChange={handleBackgroundSourceChange}
            onFileChange={handleBackgroundFileChange}
          />

          <div className="pt-6">
            <Button
              type="submit"
              size="lg"
              className="w-full group"
              disabled={
                !prompt ||
                !backgroundType ||
                !backgroundSource ||
                (backgroundSource === "custom" && !backgroundFile)
              }
            >
              <div className="flex items-center justify-center w-full">
                <span>Create Short</span>
                <ArrowRight
                  size={16}
                  className="ml-2 transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CreateForm;
