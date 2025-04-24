import React, { useMemo, memo } from "react";
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

// Create chunked grid for better performance
const DemoVideoGrid = memo(({ 
  demoVideos, 
  onDemoVideoClick 
}: { 
  demoVideos: DemoVideo[], 
  onDemoVideoClick: (demo: DemoVideo) => void 
}) => {
  // Don't render anything if no videos
  if (demoVideos.length === 0) {
    return null;
  }

  // Limit to a reasonable number for initial render (virtual scrolling would be better for larger sets)
  const limitedVideos = demoVideos.slice(0, 12);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
      {limitedVideos.map((demo) => (
        <DemoVideoCard
          key={demo.id}
          demo={demo}
          onClick={onDemoVideoClick}
        />
      ))}
    </div>
  );
});

DemoVideoGrid.displayName = "DemoVideoGrid";

// Memoize the entire ExploreSection component
const ExploreSection: React.FC<ExploreSectionProps> = memo(({
  demoVideos,
  trendingVideos,
  trendingLoading,
  isYouTubeConnected,
  onDemoVideoClick,
  onRefreshTrending,
}) => {
  // Use memoization to prevent unnecessary recalculations
  const isLoading = useMemo(() => 
    trendingLoading && trendingVideos.length === 0 && demoVideos.length === 0, 
    [trendingLoading, trendingVideos.length, demoVideos.length]
  );

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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-secondary opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-secondary animate-spin"></div>
            </div>
            <p className="ml-4 text-foreground/70">Loading videos...</p>
          </div>
        ) : (
          <DemoVideoGrid demoVideos={demoVideos} onDemoVideoClick={onDemoVideoClick} />
        )}
      </div>
    </div>
  );
});

ExploreSection.displayName = "ExploreSection";

export default ExploreSection;
