import React, { useEffect, useRef, useState } from "react";
import { Film, Youtube, AlertTriangle } from "lucide-react";

interface DemoVideo {
  id: string;
  url: string;
  title?: string;
  views?: string;
  youtubeUrl?: string;
  channel?: string;
}

interface DemoVideoCardProps {
  demo: DemoVideo;
  onClick: (demo: DemoVideo) => void;
}

const DemoVideoCard: React.FC<DemoVideoCardProps> = ({ demo, onClick }) => {
  const cardWidthClass = "w-full";
  const cardClass = "aspect-[9/16] rounded-xl overflow-hidden";
  const videoRef = useRef<HTMLVideoElement>(null);
  const playIconRef = useRef<SVGSVGElement>(null);
  const pauseIconRef = useRef<SVGSVGElement>(null);
  const soundIndicatorRef = useRef<HTMLDivElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isLocalDemo = demo.url && demo.url.includes("/demo/");
  const isYouTubeThumbnail =
    demo.url &&
    (demo.url.includes("youtube.com") || demo.url.includes("ytimg.com"));

  // Update UI based on video play/pause state
  useEffect(() => {
    if (!videoRef.current || isYouTubeThumbnail) return;

    const video = videoRef.current;
    const playIcon = playIconRef.current;
    const pauseIcon = pauseIconRef.current;
    const soundIndicator = soundIndicatorRef.current;

    // Event handlers for video state changes
    const handlePlay = () => {
      if (playIcon && pauseIcon) {
        playIcon.style.display = "none";
        pauseIcon.style.display = "block";
      }
      if (soundIndicator && !video.muted) {
        soundIndicator.style.display = "flex";
      }
    };

    const handlePause = () => {
      if (playIcon && pauseIcon) {
        playIcon.style.display = "block";
        pauseIcon.style.display = "none";
      }
      if (soundIndicator) {
        soundIndicator.style.display = "none";
      }
    };

    const handleVolumeChange = () => {
      if (soundIndicator) {
        soundIndicator.style.display = video.muted
          ? "none"
          : video.paused
          ? "none"
          : "flex";
      }
    };

    const handleError = (e) => {
      console.error(`Error loading video ${demo.id}:`, e);
      setVideoError(true);
      // Log additional information to help debug the issue
      if (demo.url) {
        console.error(`Failed URL: ${demo.url}`);
        // Try to fetch the URL with fetch API to get more error details
        fetch(demo.url, { method: 'HEAD' })
          .then(response => {
            if (!response.ok) {
              console.error(`HTTP status: ${response.status} - ${response.statusText}`);
            }
          })
          .catch(fetchError => console.error('Fetch check failed:', fetchError));
      }
    };

    const handleLoadedData = () => {
      setIsLoading(false);
    };

    // Set a timeout to detect slow loading videos
    const loadTimeout = setTimeout(() => {
      if (isLoading && !videoError) {
        console.warn(`Video loading timeout for ${demo.id}: ${demo.url}`);
        // Try to reload the video once
        if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE ||
            video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
          video.load();
        }
      }
    }, 10000); // 10 second timeout

    // Add event listeners
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);
    video.addEventListener("error", handleError);
    video.addEventListener("loadeddata", handleLoadedData);

    // Clean up event listeners and timeout
    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeChange);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadeddata", handleLoadedData);
      clearTimeout(loadTimeout);
    };
  }, [isYouTubeThumbnail, demo.id, demo.url, isLoading, videoError]);

  return (
    <div className={cardWidthClass}>
      <div
        className={`${cardClass} bg-black group relative shadow-sm hover:shadow-md transition-shadow duration-300`}
        onClick={() => onClick(demo)}
      >
        {isYouTubeThumbnail ? (
          // YouTube thumbnail
          <img
            src={demo.url}
            className="w-full h-full object-cover"
            alt={demo.title || `Short ${demo.id}`}
            onError={() => setVideoError(true)}
          />
        ) : (
          // Local video
          <video
            id={`featured-${demo.id}`}
            ref={videoRef}
            src={demo.url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            playsInline
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>

        {/* Error State */}
        {videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white p-4">
            <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
            <div className="text-center text-sm">
              <p>Video could not be loaded</p>
              <p className="text-xs mt-1 opacity-80">
                Try refreshing the page or check your connection
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !videoError && !isYouTubeThumbnail && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-4 border-secondary animate-ping opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-secondary animate-spin"></div>
            </div>
          </div>
        )}

        {/* Play/Pause Button Overlay */}
        {!isYouTubeThumbnail && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm transform group-hover:scale-110 transition-transform">
              {/* Play icon - shown when video is paused */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
                id={`featured-play-${demo.id}`}
                ref={playIconRef}
                style={{ display: "block" }}
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>

              {/* Pause icon - shown when video is playing */}
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary absolute top-0 left-0 m-3"
                id={`featured-pause-${demo.id}`}
                ref={pauseIconRef}
                style={{ display: "none" }}
              >
                <line x1="6" y1="4" x2="6" y2="20"></line>
                <line x1="18" y1="4" x2="18" y2="20"></line>
              </svg>
            </div>
          </div>
        )}

        {/* Sound indicator */}
        <div
          id={`sound-indicator-${demo.id}`}
          ref={soundIndicatorRef}
          className="absolute top-3 left-3 bg-white/80 text-black text-xs py-0.5 px-2 rounded-full flex items-center gap-1"
          style={{ display: "none" }}
        >
          <span>🔊</span>
          <span>Sound On</span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="text-white text-sm font-medium mb-1 truncate">
            {demo.title || `Creative Short #${demo.id.replace("demo", "")}`}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                {demo.youtubeUrl ? (
                  <Youtube size={12} className="text-red-500" />
                ) : (
                  <Film size={12} className="text-primary" />
                )}
              </div>
              <span className="text-white/70 text-xs ml-1.5">
                {demo.youtubeUrl ? "YouTube" : "Demo"}
              </span>
            </div>
            <div className="text-white/70 text-xs">
              {demo.views
                ? `${parseInt(demo.views).toLocaleString()} views`
                : `${Math.floor(Math.random() * 50) + 10}K views`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoVideoCard;
