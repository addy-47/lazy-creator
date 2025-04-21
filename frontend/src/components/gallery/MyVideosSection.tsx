import React from "react";
import { Button } from "@/components/Button";
import VideoCard from "./VideoCard";
import CreateNewCard from "./CreateNewCard";
import SkeletonLoader from "./SkeletonLoader";
import { UserCircle2 } from "lucide-react";

interface Video {
  id: string;
  filename: string;
  original_prompt: string;
  duration: number;
  created_at: string;
  uploaded_to_yt: boolean;
  youtube_id: string | null;
}

interface MyVideosSectionProps {
  videos: Video[];
  searchQuery: string;
  isYouTubeConnected: boolean;
  loading?: boolean;
  onCreateNew: () => void;
  onVideoClick: (video: Video) => void;
  onDownload: (videoId: string) => void;
  onShowUploadForm: (videoId: string) => void;
  onConnectYouTube: () => void;
  onOpenYouTube: (youtubeId: string) => void;
  onDelete: (videoId: string) => void;
  onClearSearch: () => void;
  isAuthenticated: boolean;
  downloadingVideoId?: string | null;
}

const MyVideosSection: React.FC<MyVideosSectionProps> = ({
  videos,
  searchQuery,
  isYouTubeConnected,
  loading = false,
  onCreateNew,
  onVideoClick,
  onDownload,
  onShowUploadForm,
  onConnectYouTube,
  onOpenYouTube,
  onDelete,
  onClearSearch,
  isAuthenticated,
  downloadingVideoId,
}) => {
  // Filter videos based on search query
  const filteredVideos = videos.filter((video) =>
    video.original_prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show auth required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="bg-card rounded-xl p-8 max-w-md w-full shadow-lg border border-border">
          <UserCircle2 className="h-16 w-16 mx-auto mb-4 text-primary opacity-80" />
          <h2 className="text-2xl font-bold mb-3">
            Sign in to view your videos
          </h2>
          <p className="text-muted-foreground mb-6">
            Your personal video gallery is available after signing in. Create
            and manage your own AI-generated shorts.
          </p>
          <Button
            onClick={() => (window.location.href = "/auth")}
            className="bg-gradient-to-r from-[#800000] to-[#E0115F] hover:from-[#800000]/90 hover:to-[#E0115F]/90 text-white w-full"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* My Videos Grid */}
      <div>
        {loading ? (
          <SkeletonLoader
            showSingle
            message="Your created short will appear here"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {/* Create New Button */}
            <CreateNewCard onClick={onCreateNew} />

            {/* User Videos */}
            {filteredVideos.length === 0 ? (
              searchQuery ? (
                <div className="w-full">
                  <div className="aspect-[9/16] rounded-xl overflow-hidden bg-muted/10 border border-dashed border-muted flex flex-col items-center justify-center p-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-3">
                        No videos matching your search
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearSearch}
                      >
                        Clear search
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null
            ) : (
              filteredVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isYouTubeConnected={isYouTubeConnected}
                  onVideoClick={onVideoClick}
                  onDownload={onDownload}
                  onShowUploadForm={onShowUploadForm}
                  onConnectYouTube={onConnectYouTube}
                  onOpenYouTube={onOpenYouTube}
                  onDelete={onDelete}
                  isDownloading={downloadingVideoId === video.id}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyVideosSection;
