
import { useState } from "react";
import { Image, Film, Upload, Info } from "lucide-react";
import { Button } from "./Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BackgroundType = "image" | "video" | null;
type BackgroundSource = "custom" | "provided" | null;

interface BackgroundSelectorProps {
  selectedType: BackgroundType;
  selectedSource: BackgroundSource;
  customFile: File | null;
  onTypeChange: (type: BackgroundType) => void;
  onSourceChange: (source: BackgroundSource) => void;
  onFileChange: (file: File | null) => void;
}

const BackgroundSelector = ({
  selectedType,
  selectedSource,
  customFile,
  onTypeChange,
  onSourceChange,
  onFileChange,
}: BackgroundSelectorProps) => {
  const [dragActive, setDragActive] = useState(false);

  const handleTypeSelect = (type: BackgroundType) => {
    onTypeChange(type);
    if (!selectedSource) {
      onSourceChange("provided");
    }
  };

  const handleSourceSelect = (source: BackgroundSource) => {
    onSourceChange(source);
    if (source === "provided") {
      onFileChange(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const fileType = file.type.split("/")[0];
      
      if ((selectedType === "image" && fileType === "image") || 
          (selectedType === "video" && fileType === "video")) {
        onFileChange(file);
      }
    }
  };

  const getFileTypeLabel = () => {
    if (selectedType === "image") return "image";
    if (selectedType === "video") return "video";
    return "file";
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Background Selection</h3>
      
      <div className="flex space-x-3">
        <button
          type="button"
          className={`flex-1 p-4 rounded-lg border transition-all ${
            selectedType === "image"
              ? "bg-primary/10 border-primary"
              : "bg-background border-border hover:border-primary/50"
          }`}
          onClick={() => handleTypeSelect("image")}
        >
          <div className="flex flex-col items-center gap-2">
            <Image size={20} className={selectedType === "image" ? "text-primary" : ""} />
            <span className="font-medium">Image</span>
          </div>
        </button>
        
        <button
          type="button"
          className={`flex-1 p-4 rounded-lg border transition-all ${
            selectedType === "video"
              ? "bg-primary/10 border-primary"
              : "bg-background border-border hover:border-primary/50"
          }`}
          onClick={() => handleTypeSelect("video")}
        >
          <div className="flex flex-col items-center gap-2">
            <Film size={20} className={selectedType === "video" ? "text-primary" : ""} />
            <span className="font-medium">Video</span>
          </div>
        </button>
      </div>
      
      {selectedType && (
        <div className="animate-fade-in space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">Source</h4>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Choose to upload your own background or use our library.<br/>
                  We'll fetch backgrounds that match your prompt content.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex space-x-3">
            <button
              type="button"
              className={`flex-1 p-3 rounded-lg border transition-all ${
                selectedSource === "provided"
                  ? "bg-primary/10 border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
              onClick={() => handleSourceSelect("provided")}
            >
              <span className="font-medium">Use our library</span>
            </button>
            
            <button
              type="button"
              className={`flex-1 p-3 rounded-lg border transition-all ${
                selectedSource === "custom"
                  ? "bg-primary/10 border-primary"
                  : "bg-background border-border hover:border-primary/50"
              }`}
              onClick={() => handleSourceSelect("custom")}
            >
              <span className="font-medium">Upload your own</span>
            </button>
          </div>
          
          {selectedSource === "custom" && (
            <div 
              className={`border-2 border-dashed rounded-lg p-6 transition-all ${
                dragActive ? "border-primary bg-primary/5" : "border-border"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              {customFile ? (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center">
                    {selectedType === "image" ? (
                      <img 
                        src={URL.createObjectURL(customFile)} 
                        alt="Preview" 
                        className="max-h-32 max-w-full rounded-md object-contain"
                      />
                    ) : (
                      <div className="bg-primary/10 p-4 rounded-full">
                        <Film size={24} className="text-primary" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{customFile.name}</p>
                    <p className="text-sm text-foreground/60">
                      {(customFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFileChange(null)}
                    type="button"
                  >
                    Remove file
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <div className="bg-primary/10 p-4 inline-block rounded-full">
                    <Upload size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      Drop your {getFileTypeLabel()} here, or{" "}
                      <label className="text-primary cursor-pointer hover:underline">
                        browse
                        <input
                          type="file"
                          className="hidden"
                          accept={selectedType === "image" ? "image/*" : "video/*"}
                          onChange={handleFileChange}
                        />
                      </label>
                    </p>
                    <p className="text-sm text-foreground/60 mt-1">
                      {selectedType === "image"
                        ? "PNG, JPG or WEBP, max 10MB"
                        : "MP4 or WEBM, max 50MB"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {selectedSource === "provided" && (
            <div className="glass-card p-4 text-center">
              <p>
                We'll provide a suitable {selectedType} background that matches your content.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BackgroundSelector;
