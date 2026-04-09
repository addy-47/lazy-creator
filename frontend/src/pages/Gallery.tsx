import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { videoApi, youtubeApi, fallbackApi } from "@/services/api";
import { useAuth } from "@/contexts/use-auth";

// Import gallery components
import GalleryHeader from "@/components/gallery/GalleryHeader";
import TabNavigation from "@/components/gallery/TabNavigation";
import MyVideosSection from "@/components/gallery/MyVideosSection";
import ExploreSection from "@/components/gallery/ExploreSection";
import {
  Video,
  YouTubeShort as DemoVideo,
} from "@/types/video";
import { UploadData, YouTubeChannel } from "@/types/youtube";

// Lazy load non-critical components
const LazyVideoDialog = React.lazy(() => import("@/components/gallery/VideoDialog"));
const LazyUploadFormDialog = React.lazy(() => import("@/components/gallery/UploadFormDialog"));

// Helper function to detect if device is low-end
const isLowEndDevice = () => {
  return (
    navigator.hardwareConcurrency <= 4 || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
};

function GalleryPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isYouTubeConnected } = useAuth();
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [demoVideos, setDemoVideos] = useState<DemoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadData>({
    video_id: "",
    title: "",
    description: "",
    tags: [],
    privacy_status: "public",
  });
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [activeVideo, setActiveVideo] = useState<Video | DemoVideo | null>(null);
  const [activeSection, setActiveSection] = useState<"my-videos" | "explore">("my-videos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYouTubeChannel, setSelectedYouTubeChannel] = useState<YouTubeChannel | null>(null);
  
  // Low-end device detection
  const isLowEnd = useRef(isLowEndDevice());

  const loadDemoVideos = useCallback((count: number) => {
    const demos: DemoVideo[] = [];
    const assetPath = "/assets/";
    
    for (let i = 1; i <= count; i++) {
      demos.push({
        id: `demo${i}`,
        url: `${assetPath}demo${i}.mp4`,
        title: `Demo Short #${i}`,
      });
    }
    setDemoVideos(demos);
  }, []);

  const loadGallery = useCallback(async () => {
    try {
      setLoading(true);
      if (!isAuthenticated) {
        setActiveSection("explore");
        loadDemoVideos(isLowEnd.current ? 3 : 6);
        return;
      }
      
      try {
        const response = await videoApi.getGallery();
        if (response && response.videos) {
          setVideos(response.videos);
        } else {
          setVideos([]);
        }
      } catch (error) {
        console.error("Failed to fetch videos:", error);
        setVideos([]);
      }
      loadDemoVideos(isLowEnd.current ? 3 : 6);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, loadDemoVideos]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const fetchYouTubeChannels = useCallback(async () => {
    if (!isYouTubeConnected || loadingChannels) return [];
    setLoadingChannels(true);
    try {
      const response = await youtubeApi.getChannels();
      if (response.status === "success" && response.channels) {
        setYoutubeChannels(response.channels);
        if (response.channels.length > 0) {
          const savedChannelId = sessionStorage.getItem("selectedYouTubeChannel");
          const selectedChannel = response.channels.find(c => c.id === savedChannelId) || response.channels[0];
          setSelectedYouTubeChannel(selectedChannel);
          setUploadData((prev: UploadData) => ({ ...prev, channelId: selectedChannel.id }));
          return response.channels;
        }
      }
      return [];
    } catch (error) {
      console.error("Error fetching YouTube channels:", error);
      return [];
    } finally {
      setLoadingChannels(false);
    }
  }, [isYouTubeConnected, loadingChannels]);

  useEffect(() => {
    if (isYouTubeConnected) {
      fetchYouTubeChannels();
    }
  }, [isYouTubeConnected, fetchYouTubeChannels]);

  const handleDownload = useCallback(async (videoId: string) => {
    try {
      setDownloadingVideoId(videoId);
      await videoApi.download(videoId, "video.mp4");
      toast.success("Download started!");
    } catch {
      toast.error("Failed to download video");
    } finally {
      setDownloadingVideoId(null);
    }
  }, []);

  const handleDelete = useCallback(async (videoId: string) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return;
    const toastId = toast.loading("Deleting video...");
    try {
      await videoApi.delete(videoId);
      setVideos((prev: Video[]) => prev.filter(v => v.id !== videoId));
      toast.success("Video deleted successfully");
    } catch (error: unknown) {
      const err = error as { response?: { status: number } };
      if (err.response?.status === 404) {
        try {
          await fallbackApi.deleteVideo(videoId);
          setVideos((prev: Video[]) => prev.filter(v => v.id !== videoId));
          toast.success("Video deleted successfully (fallback)");
        } catch {
          toast.error("Failed to delete video");
        }
      } else {
        toast.error("Failed to delete video");
      }
    } finally {
      toast.dismiss(toastId);
    }
  }, []);

  const handleUpload = useCallback(async (videoId: string) => {
    setUploading(videoId);
    const toastId = toast.loading("Uploading to YouTube...");
    try {
      const response = await youtubeApi.upload(videoId, uploadData);
      if (response && response.status === "success") {
        toast.success("Upload started!");
        setShowUploadForm(null);
      } else {
        toast.error("Upload failed: " + (response?.message || "Unknown error"));
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error("Upload failed: " + (err.response?.data?.message || "Unknown error"));
    } finally {
      toast.dismiss(toastId);
      setUploading(null);
    }
  }, [uploadData]);

  const handleShowUploadForm = useCallback((videoId: string) => {
    if (youtubeChannels.length === 0) {
      toast.error("No YouTube channel found.");
      return;
    }
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    setUploadData((prev: UploadData) => ({
      ...prev,
      title: video.title || video.prompt || "Generated Short",
      description: video.description || video.prompt,
      tags: ["shorts", "ai"],
      channelId: selectedYouTubeChannel?.id,
    }));
    setShowUploadForm(videoId);
  }, [videos, youtubeChannels, selectedYouTubeChannel]);

  const handleConnectYouTube = useCallback(async () => {
    try {
      const response = await youtubeApi.startAuth();
      if (response && response.auth_url) {
        window.open(response.auth_url, '_blank');
      }
    } catch {
      toast.error("Failed to start YouTube authentication");
    }
  }, []);

  const enhancedMyVideosProps = useMemo(() => ({
    videos,
    searchQuery,
    isYouTubeConnected,
    loading,
    onCreateNew: () => navigate("/create"),
    onVideoClick: (video: Video) => setActiveVideo(video),
    onDownload: handleDownload,
    onShowUploadForm: handleShowUploadForm,
    onConnectYouTube: handleConnectYouTube,
    onOpenYouTube: (id: string) => window.open(`https://youtube.com/watch?v=${id}`, "_blank"),
    onDelete: handleDelete,
    onClearSearch: () => setSearchQuery(""),
    isAuthenticated,
    downloadingVideoId,
    uploading,
  }), [videos, searchQuery, isYouTubeConnected, loading, navigate, handleDownload, handleShowUploadForm, handleConnectYouTube, handleDelete, isAuthenticated, downloadingVideoId, uploading]);

  return (
    <div className="pt-24 pb-20 px-4 md:px-8">
      <div className="container mx-auto">
        <GalleryHeader 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <TabNavigation 
          activeSection={activeSection}
          onTabChange={setActiveSection}
          videoCount={videos.length}
        />

        <div className="mt-8">
          {activeSection === "my-videos" ? (
            <MyVideosSection {...enhancedMyVideosProps} />
          ) : (
            <ExploreSection 
              demoVideos={demoVideos}
              trendingVideos={demoVideos} // Using demoVideos as fallback for trending
              trendingLoading={loading}
              isYouTubeConnected={isYouTubeConnected}
              onDemoVideoClick={(video: DemoVideo) => setActiveVideo(video)}
            />
          )}
        </div>
      </div>

      <React.Suspense fallback={null}>
        {activeVideo && (
          <LazyVideoDialog 
            video={activeVideo as Video}
            isYouTubeConnected={isYouTubeConnected}
            onClose={() => setActiveVideo(null)}
            onDownload={handleDownload}
            onShowUploadForm={handleShowUploadForm}
            onOpenYouTube={(id: string) => window.open(`https://youtube.com/watch?v=${id}`, "_blank")}
          />
        )}
        {showUploadForm && (
          <LazyUploadFormDialog
            isOpen={!!showUploadForm}
            onClose={() => setShowUploadForm(null)}
            uploadData={uploadData}
            setUploadData={setUploadData}
            onUpload={() => handleUpload(showUploadForm)}
            uploading={!!uploading}
            youtubeChannels={youtubeChannels}
            selectedYouTubeChannel={selectedYouTubeChannel}
            setSelectedYouTubeChannel={setSelectedYouTubeChannel}
          />
        )}
      </React.Suspense>
    </div>
  );
}

export default GalleryPage;