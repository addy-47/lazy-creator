import React from "react";
import { Youtube } from "lucide-react";
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
  onConnectYouTube: () => void;
}

const ExploreSection: React.FC<ExploreSectionProps> = ({
  demoVideos,
  trendingVideos,
  trendingLoading,
  isYouTubeConnected,
  onDemoVideoClick,
  onRefreshTrending,
  onConnectYouTube,
}) => {
  if (isYouTubeConnected) {
    return (
      <div className="space-y-6">
        {/* Trending YouTube Shorts with InfiniteMovingCards */}
        <TrendingYouTubeShorts
          demoVideos={trendingVideos}
          isYouTubeConnected={isYouTubeConnected}
          onRefresh={onRefreshTrending}
        />
        
        {trendingLoading && trendingVideos.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-secondary animate-ping opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-secondary animate-spin"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* YouTube Connection CTA */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-600/5 via-primary/5 to-background border border-red-600/10 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-2 group transition-all duration-500 hover:border-red-600/20 hover:shadow-2xl hover:shadow-red-600/5">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-red-600/10 rounded-full blur-3xl group-hover:bg-red-600/20 transition-all duration-700"></div>
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="p-4 bg-red-600/10 rounded-2xl group-hover:scale-110 transition-transform duration-500">
            <Youtube className="text-red-600" size={32} />
          </div>
          <div className="text-left">
            <h3 className="text-xl md:text-2xl font-bold tracking-tight">Connect your YouTube channel</h3>
            <p className="text-sm md:text-base text-foreground/60 max-w-md mt-1">
              Unlock real-time trending shorts and upload your creations instantly to your audience.
            </p>
          </div>
        </div>
        
        <button 
          onClick={onConnectYouTube}
          className="relative z-10 whitespace-nowrap px-10 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-red-600/20 flex items-center gap-3 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer"></div>
          <Youtube size={20} />
          <span>Connect Now</span>
        </button>
      </div>

      {/* Demo Videos Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-1 h-8 bg-primary rounded-full"></div>
            <span>Featured Demos</span>
          </h2>
          <div className="text-sm font-medium text-foreground/40 px-3 py-1 bg-secondary/30 rounded-full">
            {demoVideos.length} videos available
          </div>
        </div>

        {demoVideos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-secondary animate-ping opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-secondary animate-spin"></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 sm:gap-6">
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
