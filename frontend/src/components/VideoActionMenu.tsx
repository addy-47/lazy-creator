import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Download, Youtube, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface VideoActionMenuProps {
  videoId: string;
  isYouTubeConnected: boolean;
  isUploaded: boolean;
  youtubeId: string | null;
  onDownload: (videoId: string) => void;
  onShowUploadForm: () => void;
  onConnectYouTube: () => void;
  onOpenYouTube: (youtubeId: string) => void;
  onDelete: (videoId: string) => void;
}

const VideoActionMenu: React.FC<VideoActionMenuProps> = ({
  videoId,
  isYouTubeConnected,
  isUploaded,
  youtubeId,
  onDownload,
  onShowUploadForm,
  onConnectYouTube,
  onOpenYouTube,
  onDelete,
}) => {
  // Handler for the trigger button to prevent video playback
  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // Generic handler for menu items to prevent triggering background elements
  const handleItemClick = (e: React.MouseEvent, callback: Function) => {
    e.stopPropagation();
    e.preventDefault();
    callback();
  };

  // Stop propagation for mouse events
  const handleMenuContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Stop propagation for touch events
  const handleMenuContentTouch = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="absolute top-3 left-3 z-10 p-1 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
          onClick={handleTriggerClick}
          onTouchEnd={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <MoreVertical size={20} className="text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onClick={handleMenuContentClick}
        onTouchEnd={handleMenuContentTouch}
      >
        <DropdownMenuItem
          onClick={(e) => handleItemClick(e, () => onDownload(videoId))}
          className="cursor-pointer"
        >
          <Download className="mr-2 h-4 w-4" />
          <span>Download</span>
        </DropdownMenuItem>

        {isUploaded ? (
          <DropdownMenuItem
            onClick={(e) =>
              youtubeId && handleItemClick(e, () => onOpenYouTube(youtubeId))
            }
            className="cursor-pointer"
            disabled={!youtubeId}
          >
            <Youtube className="mr-2 h-4 w-4" />
            <span>View on YouTube</span>
          </DropdownMenuItem>
        ) : isYouTubeConnected ? (
          <DropdownMenuItem
            onClick={(e) => handleItemClick(e, onShowUploadForm)}
            className="cursor-pointer"
          >
            <Youtube className="mr-2 h-4 w-4" />
            <span>Upload to YouTube</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={(e) => handleItemClick(e, onConnectYouTube)}
            className="cursor-pointer"
          >
            <Youtube className="mr-2 h-4 w-4" />
            <span>Connect YouTube</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={(e) => handleItemClick(e, () => onDelete(videoId))}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VideoActionMenu;
