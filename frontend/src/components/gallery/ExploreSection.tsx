import React from "react";
import { Film } from "lucide-react";
import DemoVideoCard from "./DemoVideoCard";
import TrendingYouTubeShorts from "./TrendingYouTubeShorts";
import { DemoVideo } from "./types";

interface ExploreSectionProps {
  demoVideos: DemoVideo[];
  trendingVideos: DemoVideo[];
  trendingLoading: boolean;
  isYouTubeConnected: boolean;
  onDemoVideoClick: (demo: DemoVideo) => void;
  onRefreshTrending?: () => void;
}

const ExploreSection: React.FC<ExploreSectionProps> = ({
  demoVideos,
  trendingVideos,
  trendingLoading,
  isYouTubeConnected,
  onDemoVideoClick,
  onRefreshTrending,
}) => {
  return (
    <div className="space-y-10">
      {/* Trending YouTube Shorts with InfiniteMovingCards */}
      <TrendingYouTubeShorts
        demoVideos={trendingVideos}
        isYouTubeConnected={isYouTubeConnected}
        onRefresh={onRefreshTrending}
      />

      {/* Demo Videos Grid */}
      <div>
        <h2 className="text-xl font-medium mb-5 flex items-center gap-2">
          <Film size={18} />
          <span>Featured Demos</span>
        </h2>

        {trendingLoading &&
        trendingVideos.length === 0 &&
        demoVideos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-secondary animate-ping opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-secondary animate-spin"></div>
            </div>
            <p className="ml-4 text-foreground/70">Loading videos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {demoVideos.map((demo) => (
              <DemoVideoCard
                key={demo.id}
                demo={demo}
                onClick={onDemoVideoClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExploreSection;
