import React from "react";
import { Film, Youtube } from "lucide-react";

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

  const isLocalDemo = demo.url && demo.url.includes("/demo/");
  const isYouTubeThumbnail =
    demo.url &&
    (demo.url.includes("youtube.com") || demo.url.includes("ytimg.com"));

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
          />
        ) : (
          // Local video
          <video
            id={`featured-${demo.id}`}
            src={demo.url}
            className="w-full h-full object-cover"
            muted
            preload="metadata"
            playsInline
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>

        {/* Play/Pause Button Overlay */}
        {!isYouTubeThumbnail && (
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
                className="text-primary absolute top-0 left-0 m-3 hidden"
                id={`featured-pause-${demo.id}`}
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
                {demo.youtubeUrl ? "YouTube" : "Trending"}
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
