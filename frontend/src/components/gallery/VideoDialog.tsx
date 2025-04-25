import React, { useEffect, useState } from "react";
import { Download, Youtube, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/Button";
import { getAPIBaseURL } from "@/lib/socket";

interface Video {
  id: string;
  filename: string;
  original_prompt: string;
  display_title?: string;
  duration: number;
  created_at: string;
  uploaded_to_yt: boolean;
  youtube_id: string | null;
  comprehensive_content?: {
    title?: string;
    description?: string;
    script?: string;
    thumbnail_hf_prompt?: string;
  };
}

interface VideoDialogProps {
  video: Video;
  isYouTubeConnected: boolean;
  onClose: () => void;
  onDownload: (videoId: string) => void;
  onShowUploadForm: (videoId: string) => void;
  onOpenYouTube: (youtubeId: string) => void;
}

const VideoDialog: React.FC<VideoDialogProps> = ({
  video,
  isYouTubeConnected,
  onClose,
  onDownload,
  onShowUploadForm,
  onOpenYouTube,
}) => {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [showFullScript, setShowFullScript] = useState(false);

  // Get title, description, and script from comprehensive_content if available
  const title =
    video.display_title ||
    video.comprehensive_content?.title ||
    video.original_prompt;
  const description = video.comprehensive_content?.description || "";
  const script = video.comprehensive_content?.script || "";

  // Check if this is an older video without comprehensive content
  const isLegacyVideo = !video.comprehensive_content && !video.display_title;

  // Generate secure URL with auth token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setVideoUrl(
        `${getAPIBaseURL()}/api/gallery/${
          video.filename
        }?token=${encodeURIComponent(token)}`
      );
    } else {
      setVideoUrl(`${getAPIBaseURL()}/api/gallery/${video.filename}`);
    }
  }, [video.filename]);

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-2xl p-3 sm:p-5 rounded-2xl shadow-xl animate-scale-in border border-border flex flex-col relative max-h-[95vh] sm:max-h-[85vh] my-4 sm:my-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-foreground/10 transition-colors z-10"
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col md:flex-row gap-4 overflow-auto p-1 max-h-full">
          {/* Video container - adjusted for better mobile display */}
          <div className="w-full md:w-[45%] aspect-[9/16] bg-black rounded-xl overflow-hidden shrink-0 mx-auto md:mx-0" style={{ maxHeight: "70vh" }}>
            <video
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
            />
          </div>

          {/* Info and buttons - with better scaling for small screens */}
          <div className="w-full flex flex-col overflow-hidden">
            <div
              className="overflow-y-auto pr-2 flex-grow" 
              style={{ scrollbarWidth: "thin", maxHeight: "calc(70vh - 100px)" }}
            >
              <h3 className="text-lg font-semibold mb-2">{title}</h3>

              {description && (
                <p className="text-sm text-foreground/80 mb-4">{description}</p>
              )}

              <p className="text-xs text-foreground/60 mb-3">
                Created: {new Date(video.created_at).toLocaleString()}
              </p>

              {isLegacyVideo && (
                <div className="text-xs text-amber-500 dark:text-amber-400 mb-4 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                  This is a video created before the AI-generated content
                  feature was added. New videos will include title, description
                  and script information.
                </div>
              )}

              {script ? (
                <div className="mt-2 mb-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <span className="mr-2">Script</span>
                    <div className="h-px bg-border flex-grow"></div>
                  </h4>
                  <div
                    className={`text-sm text-foreground/70 whitespace-pre-wrap ${
                      !showFullScript ? "line-clamp-6" : ""
                    }`}
                  >
                    {script}
                  </div>
                  {script.split("\n").length > 6 && (
                    <button
                      onClick={() => setShowFullScript(!showFullScript)}
                      className="text-xs text-primary mt-1 flex items-center"
                    >
                      {showFullScript ? "Show less" : "Show more"}
                      <ChevronDown
                        className={`ml-1 w-3 h-3 transition-transform ${
                          showFullScript ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )}
                </div>
              ) : isLegacyVideo ? (
                <div className="mt-2 mb-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <span className="mr-2">Original Prompt</span>
                    <div className="h-px bg-border flex-grow"></div>
                  </h4>
                  <p className="text-sm text-foreground/70">
                    {video.original_prompt}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Action buttons - better spacing for small screens */}
            <div className="space-y-2 pt-3 border-t border-border mt-auto">
              <div className="w-full">
                <button
                  onClick={() => onDownload(video.id)}
                  className="w-full py-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md inline-flex items-center justify-center text-sm font-medium"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </button>
              </div>

              {!video.uploaded_to_yt && isYouTubeConnected && (
                <div className="w-full">
                  <button
                    onClick={() => {
                      onShowUploadForm(video.id);
                      onClose();
                    }}
                    className="w-full py-1.5 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md inline-flex items-center justify-center text-sm font-medium"
                  >
                    <Youtube size={16} className="mr-2" />
                    Upload to YouTube
                  </button>
                </div>
              )}

              {video.uploaded_to_yt && video.youtube_id && (
                <div className="w-full">
                  <button
                    onClick={() => onOpenYouTube(video.youtube_id!)}
                    className="w-full py-1.5 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md inline-flex items-center justify-center text-sm font-medium"
                  >
                    <Youtube size={16} className="mr-2" />
                    View on YouTube
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDialog;
