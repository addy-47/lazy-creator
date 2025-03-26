import { useState, useEffect } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "./Button";
import PromptSelector from "./PromptSelector";
import DurationSlider from "./DurationSlider";
import BackgroundSelector from "./BackgroundSelector";
import GeneratingAnimation from "./GeneratingAnimation";
import { toast } from "sonner";
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

const CreateForm = () => {
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

      // Start the video generation process
      const response = await fetch("http://localhost:4000/api/generate-short", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate video");
      }

      const data = await response.json();
      console.log("Generation started:", data);

      if (data.status === "success") {
        // Set up polling to check video status
        const checkInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(
              `http://localhost:4000/api/video-status/${data.video.id}`,
              {
                method: "GET",
              }
            );

            if (!statusResponse.ok) {
              throw new Error("Failed to check video status");
            }

            const statusData = await statusResponse.json();

            // Update progress
            if (statusData.progress) {
              setGenerationProgress(statusData.progress);
            }

            // If video is complete
            if (statusData.status === "completed") {
              clearInterval(checkInterval);
              setPollInterval(null);
              setVideoData(statusData.video);
              setIsGenerating(false);
              setIsGenerated(true);
              toast.success("Video generated successfully!");
            }
          } catch (error) {
            console.error("Error checking video status:", error);
            // Don't stop polling on error, just log it
          }
        }, 2000); // Check every 2 seconds

        setPollInterval(checkInterval);
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
    // This is now just a fallback if the polling doesn't work
    if (!videoData) {
      toast.info(
        "Video processing may still be in progress. Check the gallery later."
      );
    }
    setIsGenerating(false);
    setIsGenerated(true);
  };

  const navigateToGallery = () => {
    window.location.href = "/gallery";
  };

  return (
    <div className="max-w-3xl mx-auto">
      {isGenerating && (
        <GeneratingAnimation
          duration={Math.max(duration * 1.5, 30)} // Adjust expected time based on video duration
          onComplete={handleGenerationComplete}
        />
      )}

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

            <div className="aspect-[9/16] rounded-lg overflow-hidden bg-black flex items-center justify-center">
              {videoData ? (
                <video
                  src={`http://localhost:4000/gallery/${videoData.filename}`}
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
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `http://localhost:4000/gallery/${videoData.filename}`;
                    link.download = videoData.filename;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
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
              Create Short
              <ArrowRight
                size={16}
                className="ml-2 transition-transform group-hover:translate-x-0.5"
              />
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CreateForm;
