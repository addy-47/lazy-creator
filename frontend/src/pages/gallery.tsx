import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPIBaseURL, api, apiWithoutPreflight } from "@/lib/socket";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { useToast } from "@/components/ui/use-toast";
import { Youtube, ChevronRight } from "lucide-react";

// Import gallery components
import GalleryHeader from "@/components/gallery/GalleryHeader";
import TabNavigation from "@/components/gallery/TabNavigation";
import MyVideosSection from "@/components/gallery/MyVideosSection";
import ExploreSection from "@/components/gallery/ExploreSection";
import VideoDialog from "@/components/gallery/VideoDialog";
import UploadFormDialog from "@/components/gallery/UploadFormDialog";
import {
  Video,
  DemoVideo,
  UploadData,
  YouTubeChannel,
} from "@/components/gallery/types";
import YouTubeConnect from "@/components/YouTubeConnect";

function GalleryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isYouTubeConnected, setYouTubeConnected } =
    useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [demoVideos, setDemoVideos] = useState<DemoVideo[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showYouTubeConnectModal, setShowYouTubeConnectModal] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [activeSection, setActiveSection] = useState<"my-videos" | "explore">(
    "my-videos"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [selectedYouTubeChannel, setSelectedYouTubeChannel] =
    useState<any>(null);
  const [isFetchingChannelData, setIsFetchingChannelData] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Define checkYouTubeAuth function early so it can be referenced elsewhere
  const checkYouTubeAuth = async () => {
    if (isCheckingAuth) return;

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication required. Please log in again.");
      navigate("/auth");
      return;
    }

    setIsCheckingAuth(true);
    const toastId = toast.loading("Checking YouTube connection status...");

    try {
      // Use direct approach with proper headers
      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube-auth-status`,
        {
          headers: {
            "x-access-token": token,
            "Content-Type": "application/json",
          },
        }
      );

      toast.dismiss(toastId);

      if (response.data.status === "success") {
        if (response.data.is_connected || response.data.authenticated) {
          setYouTubeConnected(true);
          toast.success("Successfully connected to YouTube!");
        } else {
          setYouTubeConnected(false);
          toast.error("YouTube connection failed. Please try again.");
        }
      } else {
        toast.error("Unable to verify YouTube connection status.");
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error("YouTube auth status check error:", error);

      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error("Your session has expired. Please log in again.");
        localStorage.removeItem("token");
        navigate("/auth");
      } else {
        toast.error("Failed to check YouTube connection status.");
      }
    } finally {
      setIsCheckingAuth(false);
      localStorage.removeItem("checkYouTubeAuth");
    }
  };

  // Check authentication status
  useEffect(() => {
    if (!isAuthenticated && !authCheckComplete) {
      // Show sign-in toast only once
      toast.error("Please sign in to view your videos", {
        description: "You can still browse demo videos in the Demo Videos tab",
        action: {
          label: "Sign In",
          onClick: () => navigate("/auth"),
        },
      });
      setAuthCheckComplete(true);
      setActiveSection("explore"); // Switch to explore tab automatically
    }
  }, [isAuthenticated, authCheckComplete, navigate]);

  // Check if there's an active video creation on page load
  useEffect(() => {
    const creationInProgress = localStorage.getItem("videoCreationInProgress");
    if (creationInProgress === "true") {
      setCreatingVideo(true);

      // Poll for video status periodically
      const checkInterval = setInterval(async () => {
        try {
          const updatedData = await fetchVideos();
          if (updatedData?.videos?.length > videos.length) {
            // New video found, creation must be complete
            setCreatingVideo(false);
            localStorage.removeItem("videoCreationInProgress");
            clearInterval(checkInterval);
          }
        } catch (error) {
          console.error("Error checking for new videos:", error);
        }
      }, 5000); // Check every 5 seconds

      return () => clearInterval(checkInterval);
    }
  }, []);

  // Enhanced fetchData function that returns the data for use with creation check
  const fetchVideos = async () => {
    try {
      // Skip fetching videos if not authenticated
      if (!isAuthenticated) {
        setLoading(false);
        return null;
      }

      // Use apiWithoutPreflight to avoid CORS preflight issues
      const response = await apiWithoutPreflight.get("/api/gallery");

      if (response.data && response.data.videos) {
        setVideos(response.data.videos);
        return response.data;
      }
      return null;
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast.error("Error loading your gallery");
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchVideos();
    };

    // Set demo videos with dynamic URLs
    setDemoVideos([
      {
        id: "demo1",
        url: `${getAPIBaseURL()}/demo/demo1.mp4`,
        title: "Demo Short #1",
      },
      {
        id: "demo2",
        url: `${getAPIBaseURL()}/demo/demo2.mp4`,
        title: "Demo Short #2",
      },
      {
        id: "demo3",
        url: `${getAPIBaseURL()}/demo/demo3.mp4`,
        title: "Demo Short #3",
      },
      {
        id: "demo4",
        url: `${getAPIBaseURL()}/demo/demo4.mp4`,
        title: "Demo Short #4",
      },
      {
        id: "demo5",
        url: `${getAPIBaseURL()}/demo/demo5.mp4`,
        title: "Demo Short #5",
      },
      {
        id: "demo6",
        url: `${getAPIBaseURL()}/demo/demo6.mp4`,
        title: "Demo Short #6",
      },
    ]);

    fetchData();

    // Only check YouTube auth status if needed
    const shouldCheck = localStorage.getItem("checkYouTubeAuth");
    if (shouldCheck === "true") {
      checkYouTubeAuth();
    }
  }, []);

  // Check URL parameters for YouTube auth status
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // Check for YouTube auth success
    if (params.get("youtube_auth") === "success") {
      console.log("YouTube auth success detected in URL");
      setYouTubeConnected(true);
      toast.success("Successfully connected to YouTube!");

      // Update URL to remove the query parameters without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // Get new token if provided
      const token = params.get("token");
      if (token) {
        localStorage.setItem("token", token);
      }

      // Fetch videos with new token
      fetchVideos();
      return;
    }

    // Check for YouTube auth error
    if (params.get("error") === "auth_failed") {
      console.log("YouTube auth error detected in URL");
      const errorMessage = params.get("message") || "Authentication failed";
      setYouTubeConnected(false);
      toast.error(`YouTube connection error: ${errorMessage}`);

      // Update URL to remove the query parameters without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [location.search]);

  const handleDownload = async (videoId: string) => {
    try {
      // Use api instance for consistent auth
      const response = await api.get(`/api/download/${videoId}`, {
        responseType: "blob",
      });

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Get video info for filename
      const video = videos.find((v) => v.id === videoId);
      const filename = video ? video.filename : "youtube-short.mp4";

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Download started!");
    } catch (error) {
      console.error("Error downloading video:", error);
      toast.error("Failed to download video");
    }
  };

  // Function to fetch YouTube channels
  const fetchYouTubeChannels = useCallback(async () => {
    if (!isYouTubeConnected && !loadingChannels) {
      console.log("Skipping channel fetch, not connected or already loading");
      return [];
    }

    console.log("Fetching YouTube channels...");
    setLoadingChannels(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token available for channel fetch");
        setLoadingChannels(false);
        return [];
      }

      // Use direct approach with proper headers
      console.log("Making API request to fetch channels");
      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube/channels`,
        {
          headers: {
            "x-access-token": token,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Channel API response data:", JSON.stringify(response.data));

      if (response.data.status === "success" && response.data.channels) {
        console.log(
          `Found ${response.data.channels.length} channel(s):`,
          response.data.channels
        );

        if (response.data.channels.length > 0) {
          setYoutubeChannels(response.data.channels);

          // If we have a channel, update the upload data
          // Try to get saved channel from localStorage
          const savedChannelId = localStorage.getItem("selectedYouTubeChannel");
          let selectedChannel = response.data.channels[0];

          if (savedChannelId) {
            const found = response.data.channels.find(
              (c) => c.id === savedChannelId
            );
            if (found) {
              selectedChannel = found;
            }
          }

          console.log("Setting selected channel:", selectedChannel);
          setSelectedYouTubeChannel(selectedChannel);

          setUploadData((prevData) => ({
            ...prevData,
            channelId: selectedChannel.id,
          }));

          return response.data.channels;
        } else {
          console.warn("API returned success but no channels found");
          // Try again after a short delay
          setTimeout(() => {
            if (isYouTubeConnected) {
              console.log("Retrying channel fetch after delay");
              fetchYouTubeChannels();
            }
          }, 2000);
        }
      } else {
        console.log("Invalid API response format or no channels found");
      }
      return [];
    } catch (error: any) {
      console.error("Error fetching YouTube channels:", error);
      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error status:", error.response.status);
      }
      return [];
    } finally {
      setLoadingChannels(false);
    }
  }, [isYouTubeConnected, loadingChannels]);

  // Fetch channels when YouTube connection status changes
  useEffect(() => {
    if (isYouTubeConnected) {
      fetchYouTubeChannels().then((channels) => {
        // If we have channels and no selected channel yet, select the first one
        if (channels?.length > 0 && !selectedYouTubeChannel) {
          setSelectedYouTubeChannel(channels[0]);
        }
      });
    }
  }, [isYouTubeConnected]);

  // Updated connectYouTube function with more detailed debugging
  const connectYouTube = () => {
    console.log("Opening YouTube connect modal");
    // Try to refresh channel data when modal opens
    if (isYouTubeConnected && youtubeChannels.length === 0) {
      console.log(
        "YouTube already connected but no channels loaded, refreshing channel data"
      );
      setIsFetchingChannelData(true);
      fetchYouTubeChannels().finally(() => {
        setIsFetchingChannelData(false);
      });
    }
    setShowYouTubeConnectModal(true);
  };

  // Updated handleUpload function
  const handleUpload = async (videoId: string) => {
    setUploading(videoId);

    try {
      // Get the form data from state
      const {
        title,
        description,
        tags,
        useThumbnail,
        privacyStatus,
        channelId,
      } = uploadData;

      // Validate form data
      if (!title || !description) {
        toast.error("Title and description are required");
        setUploading(null);
        return;
      }

      // Show upload starting toast
      const toastId = toast.loading("Preparing to upload video to YouTube...");

      try {
        // Send upload request to the server with video metadata
        const response = await api.post(
          `/api/upload-to-youtube/${videoId}`,
          {
            title,
            description,
            tags: tags.split(",").map((tag) => tag.trim()),
            useThumbnail,
            privacyStatus,
            channelId,
          },
          {
            // Add a longer timeout for uploads
            timeout: 120000, // 2 minutes
          }
        );

        // Dismiss the loading toast
        toast.dismiss(toastId);

        if (response.data.status === "success") {
          toast.success("Video uploaded to YouTube successfully!");

          // Update the local video data with YouTube ID
          const updatedVideos = videos.map((v) => {
            if (v.id === videoId) {
              return {
                ...v,
                uploaded_to_yt: true,
                youtube_id: response.data.youtube_id,
              };
            }
            return v;
          });

          setVideos(updatedVideos);
          setShowUploadForm(null); // Close the form
        } else {
          toast.error(
            response.data.message || "Upload failed for unknown reason"
          );
        }
      } catch (axiosError: any) {
        // Dismiss the loading toast
        toast.dismiss(toastId);

        // Handle specific error cases
        if (axiosError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error(
            "YouTube upload error response:",
            axiosError.response.data
          );

          if (axiosError.response.status === 401) {
            if (axiosError.response.data?.require_auth) {
              toast.error(
                "YouTube authentication expired. Please reconnect your account.",
                { duration: 6000 }
              );
              // Start YouTube auth flow
              setYouTubeConnected(false);
              setTimeout(() => {
                connectYouTube();
              }, 2000);
            } else {
              toast.error("Authentication error. Please log in again.");
            }
          } else if (axiosError.response.status === 413) {
            toast.error("Video file is too large for YouTube upload.");
          } else {
            // Use server's error message if available
            const errorMessage =
              axiosError.response.data?.message ||
              "Failed to upload video to YouTube";
            toast.error(errorMessage);
          }
        } else if (axiosError.request) {
          // The request was made but no response was received
          console.error("No response received:", axiosError.request);
          toast.error(
            "No response from server. The upload may have timed out."
          );
        } else {
          // Something happened in setting up the request
          console.error("Error setting up request:", axiosError.message);
          toast.error("Error preparing upload request.");
        }
      }
    } catch (error) {
      console.error("Error in handleUpload:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload video to YouTube"
      );
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (videoId: string) => {
    // Confirm deletion
    if (!window.confirm("Are you sure you want to delete this video?")) {
      return;
    }

    // Show loading state
    const toastId = toast.loading("Deleting video...");

    try {
      // Make API request using api instance
      const response = await api.delete(`/api/delete-video/${videoId}`);

      // Handle success
      toast.dismiss(toastId);

      if (
        response.data &&
        (response.data.status === "success" || response.status === 200)
      ) {
        // Remove from state
        setVideos((prevVideos) =>
          prevVideos.filter((video) => video.id !== videoId)
        );
        toast.success("Video deleted successfully");
      } else {
        console.error("Delete response:", response.data);
        toast.error(response.data?.message || "Failed to delete video");
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error("Delete error:", error);

      // Special case for 404 - wrong endpoint
      if (error.response?.status === 404) {
        // Try alternative endpoint as fallback
        try {
          const fallbackResponse = await api.delete(`/api/delete/${videoId}`);

          if (
            fallbackResponse.data &&
            (fallbackResponse.data.status === "success" ||
              fallbackResponse.status === 200)
          ) {
            // Remove from state
            setVideos((prevVideos) =>
              prevVideos.filter((video) => video.id !== videoId)
            );
            toast.success("Video deleted successfully");
            return;
          }
        } catch (fallbackError) {
          console.error("Fallback delete error:", fallbackError);
        }

        toast.error("Server endpoint not found. Please contact administrator.");
      }
      // Check specific error conditions
      else if (error.response) {
        // Server responded with error
        if (error.response.status === 401 || error.response.status === 403) {
          toast.error("Session expired. Please log in again.");
          localStorage.removeItem("token");
          navigate("/auth");
        } else {
          toast.error(
            error.response.data?.message || "Server error. Please try again."
          );
        }
      } else if (error.request) {
        // No response received
        toast.error(
          "No response from server. The backend service may be down."
        );
        console.log(`Trying to reach backend at: ${getAPIBaseURL()}`);
      } else {
        // Error in request setup
        toast.error("Error sending request. Please try again.");
      }
    }
  };

  // Function to handle showing the upload form
  const handleShowUploadForm = (videoId: string) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;

    // Set the initial upload data from video metadata
    const newUploadData: UploadData = {
      title:
        video.comprehensive_content?.title ||
        video.display_title ||
        video.filename,
      description:
        video.comprehensive_content?.description || video.original_prompt,
      tags: "shorts,ai,automated",
      useThumbnail: true,
      privacyStatus: "public",
      channelId: youtubeChannels.length > 0 ? youtubeChannels[0].id : undefined,
    };

    setUploadData(newUploadData);
    setShowUploadForm(videoId);
  };

  const handleOpenYouTube = (youtubeId: string) => {
    window.open(`https://youtube.com/watch?v=${youtubeId}`, "_blank");
  };

  // Update the fetchTrendingYouTubeShorts function to show loading state
  const fetchTrendingYouTubeShorts = useCallback(async () => {
    try {
      if (!isYouTubeConnected) return; // Only fetch if connected to YouTube

      setTrendingLoading(true); // Set loading state to true

      // Use apiWithoutPreflight to avoid CORS preflight issues
      const response = await apiWithoutPreflight.get(
        "/api/youtube-trending-shorts"
      );

      if (response.data && response.data.shorts) {
        const trendingShorts = response.data.shorts.map((short) => ({
          id: short.id,
          url: short.thumbnail,
          title: short.title,
          views: short.views,
          youtubeUrl: `https://youtube.com/shorts/${short.id}`,
          channel: short.channel,
        }));

        if (trendingShorts.length > 0) {
          console.log("Setting trending shorts:", trendingShorts);
          // Create a new array for setDemoVideos to ensure React recognizes the change
          setDemoVideos([...trendingShorts]);
        }
      }
    } catch (error) {
      console.error("Error fetching trending shorts:", error);
      // Fallback to demo videos on error
    } finally {
      setTrendingLoading(false); // Set loading state to false regardless of outcome
    }
  }, [isYouTubeConnected]);

  // Fetch trending shorts when YouTube is connected
  useEffect(() => {
    if (isYouTubeConnected && activeSection === "explore") {
      console.log("YouTube is connected, fetching trending shorts");
      fetchTrendingYouTubeShorts();
    }
  }, [isYouTubeConnected, activeSection, fetchTrendingYouTubeShorts]);

  // Handle Featured Demos videos
  useEffect(() => {
    if (activeSection === "explore") {
      // Set demo videos with dynamic URLs - these are for Featured Demos section
      setDemoVideos([
        {
          id: "demo1",
          url: `${getAPIBaseURL()}/demo/demo1.mp4`,
          title: "Demo Short #1",
        },
        {
          id: "demo2",
          url: `${getAPIBaseURL()}/demo/demo2.mp4`,
          title: "Demo Short #2",
        },
        {
          id: "demo3",
          url: `${getAPIBaseURL()}/demo/demo3.mp4`,
          title: "Demo Short #3",
        },
        {
          id: "demo4",
          url: `${getAPIBaseURL()}/demo/demo4.mp4`,
          title: "Demo Short #4",
        },
        {
          id: "demo5",
          url: `${getAPIBaseURL()}/demo/demo5.mp4`,
          title: "Demo Short #5",
        },
        {
          id: "demo6",
          url: `${getAPIBaseURL()}/demo/demo6.mp4`,
          title: "Demo Short #6",
        },
      ]);
    }
  }, [activeSection]);

  // Handle demo video click
  const handleDemoVideoClick = (demo: DemoVideo) => {
    // Never redirect local demo videos
    const isLocalDemo = demo.url && demo.url.includes("/demo/");

    if (demo.youtubeUrl && !isLocalDemo) {
      window.open(demo.youtubeUrl, "_blank");
    } else {
      const videoElement = document.getElementById(
        `featured-${demo.id}`
      ) as HTMLVideoElement;
      if (videoElement) {
        if (videoElement.paused) {
          // Pause all other videos first
          document.querySelectorAll("video").forEach((v) => {
            if (v.id !== `featured-${demo.id}`) {
              v.pause();
              v.muted = true;
            }
          });

          // Play this video with sound
          videoElement.muted = false;
          videoElement.play();
        } else {
          // Pause if already playing
          videoElement.pause();
        }
      }
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-secondary animate-ping opacity-20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-primary border-secondary animate-spin"></div>
            </div>
            <p className="text-foreground/70 animate-pulse">
              Loading your gallery...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
      {/* Background pattern */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.03]"></div>

      <Navbar />

      <main className="flex-grow pt-20 pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header section with title and search */}
          <GalleryHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isAuthenticated={isAuthenticated}
            isYouTubeConnected={isYouTubeConnected}
            onConnectYouTube={connectYouTube}
            selectedChannel={selectedYouTubeChannel}
          />

          {/* Gallery Tab navigation */}
          <TabNavigation
            activeSection={activeSection}
            onTabChange={setActiveSection}
          />

          {/* My Videos Section */}
          {activeSection === "my-videos" && (
            <MyVideosSection
              videos={videos}
              searchQuery={searchQuery}
              isYouTubeConnected={isYouTubeConnected}
              loading={loading || creatingVideo}
              onCreateNew={() => navigate("/create")}
              onVideoClick={setActiveVideo}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onShowUploadForm={handleShowUploadForm}
              onConnectYouTube={connectYouTube}
              onOpenYouTube={handleOpenYouTube}
              onClearSearch={() => setSearchQuery("")}
              isAuthenticated={isAuthenticated}
            />
          )}

          {/* Explore Section */}
          {activeSection === "explore" && (
            <ExploreSection
              demoVideos={demoVideos}
              trendingLoading={trendingLoading}
              onDemoVideoClick={handleDemoVideoClick}
              isYouTubeConnected={isYouTubeConnected}
            />
          )}
        </div>
      </main>

      {/* Video Popup Dialog */}
      {activeVideo && (
        <VideoDialog
          video={activeVideo}
          isYouTubeConnected={isYouTubeConnected}
          onClose={() => setActiveVideo(null)}
          onDownload={handleDownload}
          onShowUploadForm={handleShowUploadForm}
          onOpenYouTube={handleOpenYouTube}
        />
      )}

      {/* YouTube Upload Form Dialog */}
      {showUploadForm && (
        <UploadFormDialog
          videoId={showUploadForm}
          isUploading={uploading === showUploadForm}
          uploadData={uploadData}
          generatedContent={
            videos.find((v) => v.id === showUploadForm)?.comprehensive_content
          }
          onUploadDataChange={setUploadData}
          onClose={() => setShowUploadForm(null)}
          onUpload={handleUpload}
          youtubeChannels={youtubeChannels}
        />
      )}

      {/* YouTube Connect Modal */}
      {showYouTubeConnectModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="relative bg-card shadow-lg border rounded-xl p-5 flex flex-col max-w-md w-full">
            <button
              onClick={() => setShowYouTubeConnectModal(false)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">YouTube Connection</h2>

            {isFetchingChannelData ? (
              <div className="py-4 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">
                  Refreshing channel data...
                </p>
              </div>
            ) : (
              <YouTubeConnect
                visible={showYouTubeConnectModal}
                onConnectionChange={(connected) => {
                  console.log("YouTube connection changed:", connected);
                  // Only update if the connection state actually changed
                  if (connected !== isYouTubeConnected) {
                    setYouTubeConnected(connected);
                    if (connected) {
                      console.log("YouTube connected, fetching channels...");
                      // Set loading state while fetching channels
                      setIsFetchingChannelData(true);
                      // Force a small delay to ensure backend has processed auth
                      setTimeout(() => {
                        fetchYouTubeChannels().finally(() => {
                          setIsFetchingChannelData(false);
                        });
                      }, 1000);
                    }
                  }
                }}
                onChannelSelect={(channel) => {
                  console.log("Channel selected:", channel);
                  setSelectedYouTubeChannel(channel);
                  // Update upload form if open
                  if (showUploadForm) {
                    setUploadData({
                      ...uploadData,
                      channelId: channel.id,
                    });
                  }
                  // No longer auto-closing, let user close manually
                }}
                selectedChannelId={selectedYouTubeChannel?.id}
              />
            )}

            <div className="mt-4 flex justify-between">
              <Button
                onClick={() => {
                  console.log("Manually refreshing channel data");
                  setIsFetchingChannelData(true);
                  fetchYouTubeChannels().finally(() => {
                    setIsFetchingChannelData(false);
                  });
                }}
                variant="outline"
                className="text-sm"
              >
                Refresh Channels
              </Button>
              <Button
                onClick={() => setShowYouTubeConnectModal(false)}
                variant="outline"
                className="text-sm"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default GalleryPage;
