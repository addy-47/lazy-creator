import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { getLzyDirectorBaseURL } from "@/services/config";
import { videoApi, youtubeApi, fallbackApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// Import gallery components
import GalleryHeader from "@/components/gallery/GalleryHeader";
import TabNavigation from "@/components/gallery/TabNavigation";
import MyVideosSection from "@/components/gallery/MyVideosSection";
import ExploreSection from "@/components/gallery/ExploreSection";
import {
  Video,
  DemoVideo,
  UploadData,
  YouTubeChannel,
} from "@/components/gallery/types";

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
  const { isAuthenticated, isYouTubeConnected, setYouTubeConnected } = useAuth();
  
  const [videos, setVideos] = useState<Video[]>([]);
  const [demoVideos, setDemoVideos] = useState<DemoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadData>({
    title: "",
    description: "",
    tags: "",
    useThumbnail: false,
    privacyStatus: "public",
  });
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [activeSection, setActiveSection] = useState<"my-videos" | "explore">("my-videos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYouTubeChannel, setSelectedYouTubeChannel] = useState<any>(null);
  
  // Low-end device detection
  const isLowEnd = useRef(isLowEndDevice());

  const handleAuthResponse = useCallback((data: any) => {
    const isPostRedirect = sessionStorage.getItem("checkYouTubeAuth") === "true";
    
    if (data.status === "success") {
      if (data.is_connected || data.authenticated) {
        setYouTubeConnected(true);
        if (isPostRedirect) {
          toast.success("Successfully connected to YouTube!");
          sessionStorage.removeItem("checkYouTubeAuth");
        }
      } else {
        setYouTubeConnected(false);
      }
    } else {
      if (isPostRedirect) {
        toast.error(data.message || "Unable to verify YouTube connection status.");
        sessionStorage.removeItem("checkYouTubeAuth");
      }
      setYouTubeConnected(false);
    }
  }, [setYouTubeConnected]);

  const loadDemoVideos = useCallback((count = 6) => {
    const demos: DemoVideo[] = [];
    const apiBase = getLzyDirectorBaseURL();
    const demoPath = "/lazycreator-media/demo/";
    
    for (let i = 1; i <= count; i++) {
      demos.push({
        id: `demo${i}`,
        url: `${apiBase}${demoPath}demo${i}.mp4`,
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
        if (response.data && response.data.videos) {
          setVideos(response.data.videos);
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
      if (response.data.status === "success" && response.data.channels) {
        setYoutubeChannels(response.data.channels);
        if (response.data.channels.length > 0) {
          const savedChannelId = sessionStorage.getItem("selectedYouTubeChannel");
          const selectedChannel = response.data.channels.find(c => c.id === savedChannelId) || response.data.channels[0];
          setSelectedYouTubeChannel(selectedChannel);
          setUploadData(prev => ({ ...prev, channelId: selectedChannel.id }));
          return response.data.channels;
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

  const handleDownload = async (videoId: string) => {
    try {
      setDownloadingVideoId(videoId);
      await videoApi.download(videoId, "video.mp4");
      toast.success("Download started!");
    } catch (error) {
      toast.error("Failed to download video");
    } finally {
      setDownloadingVideoId(null);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return;
    const toastId = toast.loading("Deleting video...");
    try {
      await videoApi.delete(videoId);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success("Video deleted successfully");
    } catch (error: any) {
      if (error.response?.status === 404) {
        try {
          await fallbackApi.deleteVideo(videoId);
          setVideos(prev => prev.filter(v => v.id !== videoId));
          toast.success("Video deleted successfully (fallback)");
        } catch (e) {
          toast.error("Failed to delete video");
        }
      } else {
        toast.error("Failed to delete video");
      }
    } finally {
      toast.dismiss(toastId);
    }
  };

  const handleUpload = async (videoId: string) => {
    setUploading(videoId);
    const toastId = toast.loading("Uploading to YouTube...");
    try {
      const response = await youtubeApi.upload(videoId, uploadData);
      if (response.data.status === "success") {
        toast.success("Uploaded successfully!");
        setVideos(prev => prev.map(v => v.id === videoId ? { ...v, uploaded_to_yt: true, youtube_id: response.data.youtube_id } : v));
        setShowUploadForm(null);
      } else {
        toast.error(response.data.message || "Upload failed");
      }
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      toast.dismiss(toastId);
      setUploading(null);
    }
  };

  const handleShowUploadForm = (videoId: string) => {
    if (youtubeChannels.length === 0) {
      toast.error("No YouTube channel found.");
      return;
    }
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    setUploadData(prev => ({
      ...prev,
      title: video.comprehensive_content?.title || video.display_title || video.filename,
      description: video.comprehensive_content?.description || video.original_prompt,
      tags: "shorts,ai",
      useThumbnail: true,
      channelId: selectedYouTubeChannel?.id,
    }));
    setShowUploadForm(videoId);
  };

  const handleConnectYouTube = async () => {
    try {
      const response = await youtubeApi.startAuth();
      if (response.data && response.data.auth_url) {
        window.open(response.data.auth_url, '_blank');
      }
    } catch (error) {
      toast.error("Failed to start YouTube authentication");
    }
  };

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
    downloadingVideoId
  }), [videos, searchQuery, isYouTubeConnected, loading, isAuthenticated, downloadingVideoId]);

  const enhancedExploreSectionProps = useMemo(() => ({
    demoVideos,
    trendingVideos: [],
    trendingLoading: false,
    isYouTubeConnected,
    onDemoVideoClick: (demo: DemoVideo) => {
        // Create a fake Video object from DemoVideo for the dialog
        const fakeVideo: any = {
            id: demo.id,
            filename: demo.title,
            original_prompt: demo.title,
            gcs_path: demo.url, // Dialog expects some video path
            display_title: demo.title,
            _isDemo: true
        };
        setActiveVideo(fakeVideo);
    }
  }), [demoVideos, isYouTubeConnected]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground animate-pulse">Loading gallery...</p>
      </div>
    );
  }

  return (
    <div className="container-wide py-8 px-4">
      <GalleryHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isAuthenticated={isAuthenticated}
        isYouTubeConnected={isYouTubeConnected}
        onConnectYouTube={handleConnectYouTube}
        selectedChannel={selectedYouTubeChannel}
        onRefresh={loadGallery}
      />

      <TabNavigation activeSection={activeSection} onTabChange={setActiveSection} />

      <div className="mt-8">
        {activeSection === "my-videos" ? (
          <MyVideosSection {...enhancedMyVideosProps} />
        ) : (
          <ExploreSection {...enhancedExploreSectionProps} />
        )}
      </div>

      <Suspense fallback={null}>
        {activeVideo && (
          <LazyVideoDialog
            video={activeVideo as any}
            isYouTubeConnected={isYouTubeConnected}
            onClose={() => setActiveVideo(null)}
            onDownload={handleDownload}
            onShowUploadForm={handleShowUploadForm}
            onOpenYouTube={(id) => window.open(`https://youtube.com/watch?v=${id}`, "_blank")}
          />
        )}
        {showUploadForm && (
          <LazyUploadFormDialog
            videoId={showUploadForm}
            isUploading={uploading === showUploadForm}
            uploadData={uploadData}
            onUploadDataChange={setUploadData}
            onClose={() => setShowUploadForm(null)}
            onUpload={handleUpload}
            youtubeChannels={youtubeChannels}
          />
        )}
      </Suspense>
    </div>
  );
}

export default GalleryPage;