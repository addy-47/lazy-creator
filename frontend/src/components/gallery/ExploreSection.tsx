import React, { useMemo, memo, useEffect, useState } from "react";
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
  if (!demoVideos || demoVideos.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No demo videos available
      </div>
    );
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
  // Create a stable loading state to prevent flickering
  const [showLoader, setShowLoader] = useState(true);
  
  // Debug logging to understand component state
  console.log("ExploreSection render:", {
    demoVideosCount: demoVideos?.length || 0,
    trendingVideosCount: trendingVideos?.length || 0,
    trendingLoading,
    showLoader
  });
  
  // Use effect to stabilize the loading state
  useEffect(() => {
    // Check if we have any content to display
    const hasContent = (demoVideos && demoVideos.length > 0) || 
                       (trendingVideos && trendingVideos.length > 0);
    
    // Only hide loader once we have content or explicitly know loading is done
    if (hasContent || (!trendingLoading && demoVideos)) {
      // Use a short delay to avoid flickering
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [demoVideos, trendingVideos, trendingLoading]);

  return (
    <div className="space-y-10">
      {/* Only show loader or content */}
      {showLoader ? (
        <div className="flex items-center justify-center py-12">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-secondary opacity-20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-primary border-secondary animate-spin"></div>
          </div>
          <p className="ml-4 text-foreground/70">Loading videos...</p>
        </div>
      ) : (
        <>
          {/* Trending YouTube Shorts with InfiniteMovingCards */}
          {trendingVideos && trendingVideos.length > 0 && (
            <TrendingYouTubeShorts
              demoVideos={trendingVideos}
              isYouTubeConnected={isYouTubeConnected}
              onRefresh={onRefreshTrending}
            />
          )}

          {/* Demo Videos Grid */}
          <div>
            <h2 className="text-xl font-medium mb-5 flex items-center gap-2">
              <Film size={18} />
              <span>Featured Demos</span>
            </h2>
            
            <DemoVideoGrid demoVideos={demoVideos} onDemoVideoClick={onDemoVideoClick} />
          </div>
        </>
      )}
    </div>
  );
});

ExploreSection.displayName = "ExploreSection";

export default ExploreSection;
