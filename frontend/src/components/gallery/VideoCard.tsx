import React, { useEffect, useState } from "react";
import { Film, Youtube } from "lucide-react";
import VideoActionMenu from "@/components/VideoActionMenu";
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

interface VideoCardProps {
  video: Video;
  isYouTubeConnected: boolean;
  onVideoClick: (video: Video) => void;
  onDownload: (videoId: string) => void;
  onShowUploadForm: (videoId: string) => void;
  onConnectYouTube: () => void;
  onOpenYouTube: (youtubeId: string) => void;
  onDelete: (videoId: string) => void;
}

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isYouTubeConnected,
  onVideoClick,
  onDownload,
  onShowUploadForm,
  onConnectYouTube,
  onOpenYouTube,
  onDelete,
}) => {
  const cardWidthClass = "w-full";
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
    <div className={cardWidthClass}>
      <div
        className={`${cardClass} bg-black group cursor-pointer relative shadow-sm hover:shadow-md transition-shadow duration-300`}
        onClick={() => onVideoClick(video)}
      >
        {/* Video Action Menu */}
        <VideoActionMenu
          videoId={video.id}
          isYouTubeConnected={isYouTubeConnected}
          isUploaded={video.uploaded_to_yt}
          youtubeId={video.youtube_id}
          onDownload={onDownload}
          onShowUploadForm={() => onShowUploadForm(video.id)}
          onConnectYouTube={onConnectYouTube}
          onOpenYouTube={onOpenYouTube}
          onDelete={onDelete}
        />

        {/* Video Thumbnail */}
        <video
          src={videoUrl}
          className="w-full h-full object-cover"
          preload="metadata"
        />

        {/* YouTube badge if uploaded */}
        {video.uploaded_to_yt && (
          <div className="absolute top-3 right-3 bg-red-600 text-white text-xs py-0.5 px-2 rounded-full flex items-center gap-1">
            <Youtube size={10} />
            <span>YouTube</span>
          </div>
        )}

        {/* Play Icon Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm transform group-hover:scale-110 transition-transform">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>

        {/* Video Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <p className="text-white text-sm font-medium line-clamp-2">
            {video.original_prompt}
          </p>
          <p className="text-white/70 text-xs mt-1 flex items-center">
            <span className="inline-block h-1 w-1 rounded-full bg-primary mr-2"></span>
            {new Date(video.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
