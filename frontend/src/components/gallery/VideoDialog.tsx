import React, { useEffect, useState } from "react";
import { Download, Youtube, X } from "lucide-react";
import { Button } from "@/components/Button";
import { getAPIBaseURL } from "@/lib/socket";

interface Video {
  id: string;
  filename: string;
  original_prompt: string;
  duration: number;
  created_at: string;
  uploaded_to_yt: boolean;
  youtube_id: string | null;
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
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card w-full max-w-2xl p-5 rounded-2xl shadow-xl animate-scale-in border border-border flex flex-col relative max-h-[85vh] overflow-hidden"
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

        <div className="flex flex-col md:flex-row gap-4 overflow-y-auto p-1">
          {/* Video container */}
          <div className="w-full md:w-[45%] aspect-[9/16] bg-black rounded-xl overflow-hidden shrink-0">
            <video
              src={videoUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
            />
          </div>

          {/* Info and buttons */}
          <div className="w-full flex flex-col">
            <h3 className="text-lg font-medium line-clamp-2 mb-3">
              {video.original_prompt}
            </h3>

            <p className="text-sm text-foreground/70 mb-4">
              Created: {new Date(video.created_at).toLocaleString()}
            </p>

            <div className="mt-auto space-y-3">
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
