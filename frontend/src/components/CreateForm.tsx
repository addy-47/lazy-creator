import { useState, useEffect, useRef } from "react";
import { ArrowRight, Info } from "lucide-react";
import { Button } from "./Button";
import PromptSelector from "./PromptSelector";
import DurationSlider from "./DurationSlider";
import BackgroundSelector from "./BackgroundSelector";
import { toast } from "sonner";
import { getAPIBaseURL } from "@/lib/socket";
import { scrollToStep } from "@/utils/step-transition";
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
import { StepCard } from "./ui/step-card";
import { FormProgress } from "./ui/form-progress";
import { LoadingSpinner } from "./ui/loading-spinner";
import { LiveRegion } from "./ui/live-region";
import { useNavigate } from "react-router-dom";
import { useStepFocus } from "@/hooks/use-step-focus";

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
  const [activeStep, setActiveStep] = useState(1);
  const [announcement, setAnnouncement] = useState<string>("");

  const stepRefs = {
    step1: useRef<HTMLDivElement>(null),
    step2: useRef<HTMLDivElement>(null),
    step3: useRef<HTMLDivElement>(null),
  };

  // Add focus management for each step
  useStepFocus(activeStep, stepRefs[`step${activeStep}`]);

  // Force UI update when relevant states change
  // This ensures the form progress and step cards update immediately
  const [stepCompletionStates, setStepCompletionStates] = useState({
    step1Complete: false,
    step2Complete: false,
    step3Complete: false
  });

  // Re-evaluate step completion when relevant states change
  useEffect(() => {
    setStepCompletionStates({
      step1Complete: isStepComplete(1),
      step2Complete: isStepComplete(2),
      step3Complete: isStepComplete(3)
    });
  }, [prompt, duration, backgroundType, backgroundSource, backgroundFile]);

  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!prompt;
      case 2:
        return duration >= 15 && duration <= 60;
      case 3:
        return (
          backgroundType &&
          backgroundSource &&
          (backgroundSource === "provided" ||
            (backgroundSource === "custom" && !!backgroundFile))
        );
      default:
        return false;
    }
  };

  const formSteps = [
    { title: "Content", isCompleted: isStepComplete(1) },
    { title: "Duration", isCompleted: isStepComplete(2) },
    { title: "Background", isCompleted: isStepComplete(3) },
  ] as const;

  const goToStep = (step: number) => {
    if (step === activeStep) return;

    // Set the active step immediately without transition animation
    setActiveStep(step);
    scrollToStep(stepRefs[`step${step}`].current);

    // Announce step change
    const stepData = formSteps[step - 1];
    setAnnouncement(
      `Moving to step ${step}: ${stepData.title}. ${
        stepData.isCompleted ? "This step is completed." : ""
      }`
    );
  };

  useEffect(() => {
    // Announce step completion
    const stepData = formSteps[activeStep - 1];
    if (stepData?.isCompleted) {
      setAnnouncement(`Step ${activeStep} completed: ${stepData.title}`);
    }
  }, [formSteps, activeStep]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    // Immediately check if this step is now complete
    if (value) {
      setAnnouncement(`Step 1 completed: Content`);
    }
  };

  const handleDurationChange = (value: number) => {
    setDuration(value);
    // Immediately check if this step is now complete
    if (value >= 15 && value <= 60) {
      setAnnouncement(`Step 2 completed: Duration`);
    }
  };

  const handleBackgroundTypeChange = (type: "image" | "video" | null) => {
    setBackgroundType(type);
    checkBackgroundCompletion(type, backgroundSource, backgroundFile);
  };

  const handleBackgroundSourceChange = (
    source: "custom" | "provided" | null
  ) => {
    setBackgroundSource(source);
    checkBackgroundCompletion(backgroundType, source, backgroundFile);
  };

  const handleBackgroundFileChange = (file: File | null) => {
    setBackgroundFile(file);
    checkBackgroundCompletion(backgroundType, backgroundSource, file);
  };

  // Helper to check if background step is completed after any change
  const checkBackgroundCompletion = (
    type: "image" | "video" | null,
    source: "custom" | "provided" | null,
    file: File | null
  ) => {
    const isCompleted = 
      type && 
      source && 
      (source === "provided" || (source === "custom" && !!file));
    
    if (isCompleted) {
      setAnnouncement(`Step 3 completed: Background`);
    }
  };

  // Cleanup poll interval on component unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow keyboard navigation only when not in an input/textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          if (activeStep < 3) goToStep(activeStep + 1);
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          if (activeStep > 1) goToStep(activeStep - 1);
          break;
        case "1":
        case "2":
        case "3":
          e.preventDefault();
          goToStep(parseInt(e.key));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStep]);

  const handleSubmit = (e: React.FormEvent) => {
    if (e) e.preventDefault();

    // Check all steps are complete before proceeding
    if (!isStepComplete(1)) {
      toast.error("Please select or write a prompt");
      goToStep(1);
      return;
    }

    if (!isStepComplete(2)) {
      toast.error("Please set a duration between 15 and 60 seconds");
      goToStep(2);
      return;
    }

    if (!isStepComplete(3)) {
      if (!backgroundType) {
        toast.error("Please select a background type");
      } else if (!backgroundSource) {
        toast.error("Please select a background source");
      } else if (backgroundSource === "custom" && !backgroundFile) {
        toast.error("Please upload a background file or choose 'Use our library'");
      }
      goToStep(3);
      return;
    }

    // Show confirmation dialog
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

  if (isGenerated) {
    return (
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
    );
  }

  return (
    <div className="max-w-4xl mx-auto mobile-vh">
      <LiveRegion message={announcement} />

      <div className="sticky-top py-4 bg-gradient-to-b from-background via-background to-transparent">
        <FormProgress
          steps={formSteps}
          currentStep={activeStep}
          className="mb-8"
          onStepClick={goToStep}
        />
      </div>

      <div className="space-y-8 pb-20">
        <StepCard
          ref={stepRefs.step1}
          step={1}
          title="Choose Your Content"
          description="Select a template or write your own prompt"
          isActive={activeStep === 1}
          isCompleted={isStepComplete(1)}
          onClick={() => goToStep(1)}
          className="cursor-pointer transition-all duration-300"
          aria-label={`Step 1: Choose Your Content ${
            isStepComplete(1) ? "(Completed)" : ""
          }`}
        >
          <PromptSelector
            selectedPrompt={prompt}
            onPromptChange={(value) => {
              handlePromptChange(value);
            }}
          />
        </StepCard>

        <StepCard
          ref={stepRefs.step2}
          step={2}
          title="Set Duration"
          description="Choose the length of your Short"
          isActive={activeStep === 2}
          isCompleted={isStepComplete(2)}
          onClick={() => goToStep(2)}
          className="cursor-pointer transition-all duration-300"
          aria-label={`Step 2: Set Duration ${
            isStepComplete(2) ? "(Completed)" : ""
          }`}
        >
          <DurationSlider
            selectedDuration={duration}
            onDurationChange={(value) => {
              handleDurationChange(value);
            }}
          />
        </StepCard>

        <StepCard
          ref={stepRefs.step3}
          step={3}
          title="Choose Background"
          description="Select your video or image background"
          isActive={activeStep === 3}
          isCompleted={isStepComplete(3)}
          onClick={() => goToStep(3)}
          className="cursor-pointer transition-all duration-300"
          aria-label={`Step 3: Choose Background ${
            isStepComplete(3) ? "(Completed)" : ""
          }`}
        >
          <BackgroundSelector
            selectedType={backgroundType}
            selectedSource={backgroundSource}
            customFile={backgroundFile}
            onTypeChange={handleBackgroundTypeChange}
            onSourceChange={handleBackgroundSourceChange}
            onFileChange={handleBackgroundFileChange}
          />
        </StepCard>
      </div>

      <div className="sticky-bottom pt-6 pb-2 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          type="button"
          size="lg"
          className="w-full group"
          onClick={handleSubmit}
          disabled={
            !isStepComplete(1) || !isStepComplete(2) || !isStepComplete(3)
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
    </div>
  );
};

export default CreateForm;
