import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Download, Youtube, Trash2 } from "lucide-react";

interface VideoActionMenuProps {
  videoId: string;
  isYouTubeConnected: boolean;
  isUploaded: boolean;
  youtubeId: string | null | undefined;
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
  const [open, setOpen] = useState(false);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleItemClick = (e: React.MouseEvent | React.TouchEvent, action: () => void, closeMenu = true) => {
    e.stopPropagation();
    e.preventDefault();
    action();
    
    if (closeMenu) {
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background shadow-sm transition-all"
          onClick={handleTriggerClick}
        >
          <MoreVertical size={18} className="text-foreground/70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl p-1 shadow-xl border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onClick={(e) => handleItemClick(e, () => onDownload(videoId), true)}
          className="cursor-pointer gap-2 p-2.5 rounded-lg"
        >
          <Download className="h-4 w-4 text-primary" />
          <span className="font-medium">Download</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 opacity-50" />

        {isUploaded ? (
          <DropdownMenuItem
            onClick={(e) =>
              youtubeId && handleItemClick(e, () => onOpenYouTube(youtubeId), true)
            }
            className="cursor-pointer gap-2 p-2.5 rounded-lg"
            disabled={!youtubeId}
          >
            <Youtube className="h-4 w-4 text-red-500" />
            <span className="font-medium text-red-500">View on YouTube</span>
          </DropdownMenuItem>
        ) : isYouTubeConnected ? (
          <DropdownMenuItem
            onClick={(e) => handleItemClick(e, onShowUploadForm, true)}
            className="cursor-pointer gap-2 p-2.5 rounded-lg"
          >
            <Youtube className="h-4 w-4 text-red-500" />
            <span className="font-medium">Upload to YouTube</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={(e) => handleItemClick(e, onConnectYouTube, true)}
            className="cursor-pointer gap-2 p-2.5 rounded-lg"
          >
            <Youtube className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Connect YouTube</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1 opacity-50" />
        
        <DropdownMenuItem
          onClick={(e) => handleItemClick(e, () => onDelete(videoId), true)}
          className="cursor-pointer gap-2 p-2.5 rounded-lg text-destructive focus:text-destructive focus:bg-destructive/5"
        >
          <Trash2 className="h-4 w-4" />
          <span className="font-medium">Delete Video</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VideoActionMenu;
