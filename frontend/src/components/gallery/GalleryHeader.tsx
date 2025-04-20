import React from "react";
import { SearchIcon, Youtube, ChevronRight } from "lucide-react";
import { Button } from "@/components/Button";

interface GalleryHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isAuthenticated: boolean;
  isYouTubeConnected: boolean;
  onConnectYouTube: () => void;
  selectedChannel?: any;
}

const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  searchQuery,
  onSearchChange,
  isAuthenticated,
  isYouTubeConnected,
  onConnectYouTube,
  selectedChannel,
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

      <div className="flex flex-col space-y-2 w-full md:w-auto">
        <div className="flex flex-row items-center justify-end gap-3">
          <div className="relative flex items-center flex-grow md:flex-grow-0">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search your videos..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 py-2 pr-4 rounded-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none w-full md:w-64"
            />
          </div>

          <Button
            onClick={onConnectYouTube}
            className={`flex items-center gap-2 rounded-full shrink-0 ${
              isYouTubeConnected
                ? "bg-primary/10 hover:bg-primary/20 text-primary"
                : "bg-gradient-to-r from-[#800000] to-[#E0115F] hover:from-[#800000]/90 hover:to-[#E0115F]/90 text-white border-transparent"
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
        </div>

        {isYouTubeConnected && selectedChannel && (
          <div className="flex justify-end">
            <div
              className="inline-flex items-center bg-background/50 border border-border rounded-full p-0.5 cursor-pointer hover:bg-background/80 transition-colors text-xs"
              onClick={onConnectYouTube}
            >
              {selectedChannel.thumbnailUrl ? (
                <img
                  src={selectedChannel.thumbnailUrl}
                  alt={selectedChannel.title}
                  className="w-4 h-4 rounded-full flex-shrink-0 mr-1"
                />
              ) : (
                <Youtube
                  size={12}
                  className="text-red-500 flex-shrink-0 mr-1"
                />
              )}
              <span className="font-medium pr-1">{selectedChannel.title}</span>
              <ChevronRight
                size={10}
                className="text-muted-foreground flex-shrink-0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryHeader;
