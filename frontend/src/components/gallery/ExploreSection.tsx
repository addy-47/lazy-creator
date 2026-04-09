import React from "react";
import { Film, Youtube } from "lucide-react";
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
  return (
    <div className="space-y-10">
      {/* YouTube Connection CTA */}
      {!isYouTubeConnected && (
        <div className="bg-gradient-to-r from-red-600/10 to-primary/10 border border-red-600/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 mb-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600/20 rounded-xl">
              <Youtube className="text-red-500" size={24} />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold">Connect your YouTube channel</h3>
              <p className="text-sm text-foreground/70 max-w-md">Connect to see real trending shorts and upload your creations directly to your channel.</p>
            </div>
          </div>
          <button 
            onClick={onConnectYouTube}
            className="whitespace-nowrap px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-medium transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-red-600/20 flex items-center gap-2"
          >
            <Youtube size={18} />
            <span>Connect Now</span>
          </button>
        </div>
      )}

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
