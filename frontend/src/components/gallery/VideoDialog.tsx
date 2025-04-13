import React, { useEffect, useState } from "react";
import { Download, Youtube } from "lucide-react";
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
  const cardClass = "aspect-[9/16] rounded-xl overflow-hidden";
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
        className="bg-card max-w-2xl w-full p-4 rounded-2xl shadow-xl animate-scale-in border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${cardClass} bg-black mb-4`}>
          <video
            src={videoUrl}
            className="w-full h-full object-contain"
            controls
            autoPlay
          />
        </div>

        <div className="px-2 pb-3">
          <h3 className="text-xl font-medium line-clamp-2 mb-2 mt-1">
            {video.original_prompt}
          </h3>
          <p className="text-sm text-foreground/70 mb-6">
            Created: {new Date(video.created_at).toLocaleString()}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-full"
            >
              Close
            </Button>
            <Button
              onClick={() => onDownload(video.id)}
              className="rounded-full"
            >
              <Download size={16} className="mr-2" />
              Download
            </Button>
            {!video.uploaded_to_yt && isYouTubeConnected && (
              <Button
                variant="outline"
                onClick={() => {
                  onShowUploadForm(video.id);
                  onClose();
                }}
                className="rounded-full"
              >
                <Youtube size={16} className="mr-2" />
                Upload to YouTube
              </Button>
            )}
            {video.uploaded_to_yt && video.youtube_id && (
              <Button
                variant="outline"
                onClick={() => onOpenYouTube(video.youtube_id!)}
                className="rounded-full"
              >
                <Youtube size={16} className="mr-2" />
                View on YouTube
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDialog;
