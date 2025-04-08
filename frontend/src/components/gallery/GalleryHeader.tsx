import React from "react";
import { SearchIcon, Youtube } from "lucide-react";
import { Button } from "@/components/Button";

interface GalleryHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isAuthenticated: boolean;
  youtubeAuthChecked: boolean;
  isYouTubeConnected: boolean;
  onConnectYouTube: () => void;
}

const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  searchQuery,
  onSearchChange,
  isAuthenticated,
  youtubeAuthChecked,
  isYouTubeConnected,
  onConnectYouTube,
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 mb-8">
      <div>
        <h1 className="text-3xl font-semibold md:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
          Your Shorts Gallery
        </h1>
        <p className="text-foreground/60 mt-1">
          Explore and manage your AI-generated content
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search your videos..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 py-2 pr-4 rounded-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none w-full sm:w-64"
          />
        </div>

        {/* YouTube connect button - Always visible */}
        {isAuthenticated && youtubeAuthChecked && (
          <Button
            onClick={onConnectYouTube}
            className={`flex items-center gap-2 rounded-full ${
              isYouTubeConnected
                ? "bg-primary/10 hover:bg-primary/20 text-primary"
                : "bg-primary hover:bg-primary/90 text-white"
            }`}
            variant={isYouTubeConnected ? "outline" : "default"}
          >
            <div className="flex items-center gap-2">
              <Youtube size={16} className="flex-shrink-0" />
              <span>
                {isYouTubeConnected ? "YouTube Connected" : "Connect YouTube"}
              </span>
            </div>
          </Button>
        )}
      </div>
    </div>
  );
};

export default GalleryHeader;
