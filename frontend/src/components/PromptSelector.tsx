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
    prompt:
      "Create a short about the most recent developments in artificial intelligence",
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
}

const PromptSelector = ({
  selectedPrompt,
  onPromptChange,
}: PromptSelectorProps) => {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    if (!selectedPrompt && !isCustom) {
      onPromptChange(predefinedPrompts[0].prompt);
    }
  }, []);

  const handlePredefinedPromptSelect = (prompt: string) => {
    onPromptChange(prompt);
    setIsCustom(false);
  };

  const handleCustomPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setCustomPrompt(value);
    onPromptChange(value);
  };

  const toggleCustomPrompt = () => {
    if (!isCustom) {
      setIsCustom(true);
      if (!customPrompt) {
        setCustomPrompt("");
        onPromptChange("");
      }
    }
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
            placeholder="Be specific about what you want in your YouTube Short..."
            value={customPrompt}
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
