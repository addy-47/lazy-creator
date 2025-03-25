import { useState } from "react";
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

  const startGeneration = () => {
    setShowConfirmDialog(false);
    setIsGenerating(true);

    // Simulating the generation process
    // In a real app, this would be an API call to your backend
    console.log({
      prompt,
      duration,
      backgroundType,
      backgroundSource,
      backgroundFile,
    });
  };

  const handleGenerationComplete = () => {
    setIsGenerating(false);
    setIsGenerated(true);
  };

  return (
    <div className="max-w-3xl mx-auto">
      {isGenerating && (
        <GeneratingAnimation
          duration={30}
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
              The process will take approximately 30 seconds.
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

            <div className="aspect-video rounded-lg bg-black/5 flex items-center justify-center">
              <p className="text-foreground/70">
                Video preview would appear here
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Button>Download</Button>
              <Button variant="outline">Upload to YouTube</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setIsGenerated(false);
                  setPrompt("");
                  setDuration(20);
                  setBackgroundType(null);
                  setBackgroundSource(null);
                  setBackgroundFile(null);
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
