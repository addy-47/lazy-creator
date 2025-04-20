import React from "react";
import { Youtube, ExternalLink, Film, RefreshCw } from "lucide-react";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { DemoVideo } from "./types";
import { getAPIBaseURL } from "@/lib/socket";

interface TrendingYouTubeShortsProps {
  demoVideos: DemoVideo[];
  isYouTubeConnected: boolean;
  onRefresh?: () => void;
}

const TrendingYouTubeShorts: React.FC<TrendingYouTubeShortsProps> = ({
  demoVideos,
  isYouTubeConnected,
  onRefresh,
}) => {
  // Only show this section when there are videos
  if (demoVideos.length === 0) {
    return null;
  }

  // Create items for InfiniteMovingCards
  const cardItems = demoVideos.map((video) => ({
    id: video.id,
    content: (
      <div
        className="group relative overflow-hidden rounded-xl w-56 h-auto cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 mx-2"
        onClick={() => {
          if (video.youtubeUrl) {
            window.open(video.youtubeUrl, "_blank");
          }
        }}
      >
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-t-xl">
          {/* Thumbnail */}
          {video.url &&
          (video.url.includes("youtube.com") ||
            video.url.includes("ytimg.com")) ? (
            <img
              src={video.url}
              alt={video.title || "YouTube Short"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <video
              src={video.url}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              muted
              preload="metadata"
              playsInline
            />
          )}

          {/* YouTube or Demo Badge */}
          <div
            className={`absolute top-2 right-2 text-white text-xs py-0.5 px-2 rounded-full flex items-center gap-1 shadow-sm ${
              video.youtubeUrl ? "bg-red-600" : "bg-primary"
            }`}
          >
            {video.youtubeUrl ? (
              <>
                <Youtube size={10} />
                <span>YouTube</span>
              </>
            ) : (
              <>
                <Film size={10} />
                <span>Demo</span>
              </>
            )}
          </div>

          {/* Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
            <div className="p-3 rounded-full bg-white/90 backdrop-blur-sm transform group-hover:scale-110 transition-transform">
              {video.youtubeUrl ? (
                <Youtube size={24} className="text-red-600" />
              ) : (
                <Film size={24} className="text-primary" />
              )}
            </div>
          </div>
        </div>

        {/* Video Info */}
        <div className="p-3 bg-card/90 backdrop-blur-sm">
          <h3 className="font-medium text-sm line-clamp-1">
            {video.title || `Trending Short #${video.id}`}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="opacity-80">
                {video.channel
                  ? `@${video.channel}`
                  : video.youtubeUrl
                  ? "YouTube"
                  : "Demo"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {video.views
                ? `${parseInt(video.views).toLocaleString()} views`
                : `${Math.floor(Math.random() * 50) + 10}K views`}
            </div>
          </div>
        </div>
      </div>
    ),
  }));

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-medium flex items-center gap-2">
          {isYouTubeConnected ? (
            <>
              <Youtube size={18} className="text-red-500" />
              <span>Trending YouTube Shorts</span>
            </>
          ) : (
            <>
              <Film size={18} />
              <span>Trending Shorts</span>
            </>
          )}
        </h2>

        <div className="flex items-center gap-3">
          {/* Refresh button */}
          {onRefresh && isYouTubeConnected && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onRefresh();
              }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors p-1 rounded-full hover:bg-secondary/30"
              title="Refresh trending videos"
            >
              <RefreshCw size={16} />
            </button>
          )}

          {isYouTubeConnected && (
            <a
              href="https://www.youtube.com/shorts"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <span>View All</span>
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      <InfiniteMovingCards
        items={cardItems}
        direction="left"
        speed="slow"
        pauseOnHover={true}
        className="py-4"
        itemClassName="px-2"
      />
    </div>
  );
};

export default TrendingYouTubeShorts;
