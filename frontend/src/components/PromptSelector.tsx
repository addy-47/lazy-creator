import { useState, useEffect } from "react";
import { MessageSquare } from "lucide-react";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const predefinedPrompts = [
  {
    id: 1,
    title: "Latest AI News",
    prompt: "Create a short about the latest developments in AI technology",
  },
  {
    id: 2,
    title: "Tech Gadget Review",
    prompt:
      "Review the latest smartphone features in a compelling short format",
  },
  {
    id: 3,
    title: "Coding Tips",
    prompt: "Share 3 essential coding tips for beginners in a brief tutorial",
  },
  {
    id: 4,
    title: "Daily Motivation",
    prompt: "Create an inspirational short about overcoming challenges",
  },
  {
    id: 5,
    title: "Productivity Hack",
    prompt: "Explain a time-saving productivity technique in under 60 seconds",
  },
  {
    id: 6,
    title: "Life Hack",
    prompt: "Demonstrate a clever everyday life hack that saves time or money",
  },
];

interface PromptSelectorProps {
  selectedPrompt: string;
  onPromptChange: (prompt: string) => void;
  onCustomPromptStateChange?: (isCustom: boolean) => void;
  isCustomPromptExternal?: boolean;
}

const PromptSelector = ({
  selectedPrompt,
  onPromptChange,
  onCustomPromptStateChange,
  isCustomPromptExternal,
}: PromptSelectorProps) => {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isCustomInternal, setIsCustomInternal] = useState(false);

  // Use external custom state if provided, otherwise use internal state
  const isCustom =
    isCustomPromptExternal !== undefined
      ? isCustomPromptExternal
      : isCustomInternal;

  // Effect to notify parent component when isCustom changes
  useEffect(() => {
    if (onCustomPromptStateChange) {
      onCustomPromptStateChange(isCustom);
    }
  }, [isCustom, onCustomPromptStateChange]);

  // Effect to initialize the form on first load and handle selecting a predefined prompt
  useEffect(() => {
    // Check if we're first loading with no prompt selected and not in custom mode
    if (!selectedPrompt && !isCustom) {
      // Set to the first predefined prompt by default only if not in custom mode
      onPromptChange(predefinedPrompts[0].prompt);
      return;
    }

    // Check if the currently selected prompt matches any predefined prompts
    const matchingPredefinedPrompt = predefinedPrompts.find(
      (p) => p.prompt === selectedPrompt
    );

    // If we're in custom mode (internally managed), update the custom prompt text field
    if (isCustom && isCustomPromptExternal === undefined) {
      // Only set customPrompt if it's not being toggled to empty state
      if (selectedPrompt && selectedPrompt !== "") {
        setCustomPrompt(selectedPrompt);
      }
    }
    // If we've got a predefined prompt selected, make sure we're not in custom mode (internally managed)
    else if (matchingPredefinedPrompt && isCustomPromptExternal === undefined) {
      setIsCustomInternal(false);
    }
    // If we have a prompt but it's not a predefined one, we must be in custom mode (internally managed)
    else if (selectedPrompt && isCustomPromptExternal === undefined) {
      setIsCustomInternal(true);
      setCustomPrompt(selectedPrompt);
    }
    // NOTE: Logic for isCustomPromptExternal === true is removed here.
    // The parent component (CreateForm) manages the selectedPrompt state,
    // and the Textarea value is directly bound to selectedPrompt when external.
  }, [selectedPrompt, isCustom, isCustomPromptExternal, onPromptChange]); // Added onPromptChange dependency

  const handlePredefinedPromptSelect = (prompt: string) => {
    onPromptChange(prompt);
    if (isCustomPromptExternal === undefined) {
      setIsCustomInternal(false);
    } else if (onCustomPromptStateChange) {
      onCustomPromptStateChange(false);
    }
  };

  const handleCustomPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    // Only update the parent's state. The internal customPrompt state
    // is only relevant when isCustomPromptExternal is undefined.
    onPromptChange(value);
    // If managing state internally, update internal state as well
    if (isCustomPromptExternal === undefined) {
      setCustomPrompt(value);
    }
  };

  const toggleCustomPrompt = () => {
    // Always set to custom mode when toggling
    if (isCustomPromptExternal === undefined) {
      setIsCustomInternal(true);
    } else if (onCustomPromptStateChange) {
      onCustomPromptStateChange(true);
    }

    // Always clear the custom prompt when switching to custom mode
    setCustomPrompt("");
    onPromptChange("");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Select a Prompt</h3>

      <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-primary/50 scrollbar-track-transparent">
        <div className="flex space-x-2 pb-2 min-w-max">
          {predefinedPrompts.map((promptItem) => (
            <button
              key={promptItem.id}
              className={`flex-shrink-0 px-4 py-2 rounded-full border transition-all focus:outline-none ${
                !isCustom && selectedPrompt === promptItem.prompt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
              onClick={() => handlePredefinedPromptSelect(promptItem.prompt)}
            >
              {promptItem.title}
            </button>
          ))}
          <button
            className={`flex-shrink-0 px-4 py-2 rounded-full border transition-all focus:outline-none ${
              isCustom
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50"
            }`}
            onClick={toggleCustomPrompt}
          >
            Custom
          </button>
        </div>
      </div>

      {isCustom ? (
        <div className="animate-fade-in space-y-2">
          <label htmlFor="custom-prompt" className="text-sm font-medium">
            Write your custom prompt
          </label>
          <Textarea
            id="custom-prompt"
            className="w-full p-3 min-h-[120px] rounded-lg resize-none focus:ring-2 focus:ring-primary/50"
            placeholder="Write your custom prompt here..."
            value={
              isCustomPromptExternal !== undefined
                ? selectedPrompt
                : customPrompt
            }
            onChange={handleCustomPromptChange}
            autoFocus
          />
          <p className="text-xs text-foreground/60">
            Try to be detailed and specific about the content you want in your
            Short.
          </p>
        </div>
      ) : (
        <div className="glass-card p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="mt-1">
              <MessageSquare size={18} className="text-primary" />
            </div>
            <div>
              <div className="font-medium mb-1">Selected Prompt</div>
              <p className="text-foreground/70">{selectedPrompt}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptSelector;
