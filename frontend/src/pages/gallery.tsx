import React, { useState, useEffect, useContext, useCallback } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPIBaseURL } from "@/lib/socket";
import { AuthContext } from "../App";

// Import gallery components
import GalleryHeader from "@/components/gallery/GalleryHeader";
import TabNavigation from "@/components/gallery/TabNavigation";
import MyVideosSection from "@/components/gallery/MyVideosSection";
import ExploreSection from "@/components/gallery/ExploreSection";
import VideoDialog from "@/components/gallery/VideoDialog";
import UploadFormDialog from "@/components/gallery/UploadFormDialog";
import { Video, DemoVideo, UploadData } from "@/components/gallery/types";

function GalleryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, username, isYouTubeConnected, setYouTubeConnected } =
    useContext(AuthContext);
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
  });
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [activeSection, setActiveSection] = useState<"my-videos" | "explore">(
    "my-videos"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [creatingVideo, setCreatingVideo] = useState(false);

  // Define checkYouTubeAuth function early so it can be referenced elsewhere
  const checkYouTubeAuth = async () => {
    if (isCheckingAuth) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    setIsCheckingAuth(true);
    const toastId = toast.loading("Checking YouTube connection status...");

    try {
      const response = await axios({
        method: "GET",
        url: `${getAPIBaseURL()}/api/youtube-auth-status`,
        headers: {
          "x-access-token": token,
          "Content-Type": "application/json",
        },
      });

      toast.dismiss(toastId);

      if (response.data.status === "success") {
        if (response.data.is_connected) {
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
      // Get authentication token
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("Authentication token missing");
        setLoading(false);
        return null;
      }

      const response = await axios.get(`${getAPIBaseURL()}/api/gallery`, {
        headers: {
          "x-access-token": token,
        },
      });

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

  // Check authentication status when returning from YouTube auth
  useEffect(() => {
    const shouldCheck = localStorage.getItem("checkYouTubeAuth");

    if (shouldCheck === "true") {
      checkYouTubeAuth();
    }
  }, []);

  // Handle YouTube auth callback from URL
  useEffect(() => {
    // Check if this is a YouTube auth callback
    if (location.pathname === "/youtube-auth-callback") {
      // Get query parameters
      const urlParams = new URLSearchParams(location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");

      if (code && state) {
        // Redirect to backend endpoint to complete OAuth flow
        window.location.href = `${getAPIBaseURL()}/api/youtube-auth-callback?code=${code}&state=${state}`;
      } else {
        // If missing parameters, go back to gallery
        toast.error("Authentication failed: Missing parameters");
        navigate("/gallery");
      }
    }
  }, [location, navigate]);

  const handleDownload = async (videoId: string) => {
    try {
      // Get authentication token
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required. Please log in.");
        navigate("/auth");
        return;
      }

      const response = await axios.get(
        `${getAPIBaseURL()}/api/download/${videoId}`,
        {
          responseType: "blob",
          headers: {
            "x-access-token": token,
          },
        }
      );

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

  const connectYouTube = async () => {
    if (isConnecting) {
      // Prevent multiple connection attempts
      toast.info("YouTube connection already in progress");
      return;
    }

    setIsConnecting(true);
    const toastId = toast.loading("Connecting to YouTube...");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("You need to be logged in to connect YouTube");
        navigate("/auth");
        return;
      }

      // Set a flag in localStorage that we're expecting a callback
      localStorage.setItem("checkYouTubeAuth", "true");

      // Get the auth URL
      const response = await axios({
        method: "GET",
        url: `${getAPIBaseURL()}/api/youtube-auth-start`,
        headers: {
          "x-access-token": token,
        },
        params: {
          redirect_uri: `${window.location.origin}/gallery`,
        },
      });

      if (response.data.status === "success" && response.data.auth_url) {
        toast.dismiss(toastId);
        toast.info("Opening YouTube authentication...");

        // Open auth URL in a new window
        const authWindow = window.open(
          response.data.auth_url,
          "YouTube Authentication",
          "width=800,height=600"
        );

        // Set up an interval to check if the window was closed
        let authCheckInterval: NodeJS.Timeout | null = null;
        if (authWindow) {
          authCheckInterval = setInterval(() => {
            if (authWindow.closed) {
              if (authCheckInterval) {
                clearInterval(authCheckInterval);
                authCheckInterval = null;
              }

              // Check auth status after window closes
              setTimeout(() => {
                checkYouTubeAuth();
              }, 1000);
            }
          }, 500);

          // Add window cleanup after 2 minutes (failsafe)
          setTimeout(() => {
            if (authCheckInterval) {
              clearInterval(authCheckInterval);
              authCheckInterval = null;
            }
            if (!authWindow.closed) {
              authWindow.close();
            }

            checkYouTubeAuth();
          }, 120000);
        } else {
          toast.error(
            "Unable to open authentication window. Please enable popups and try again."
          );
        }
      } else {
        toast.dismiss(toastId);
        toast.error("Failed to start YouTube authentication");
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error("Error connecting to YouTube:", error);
      toast.error(
        error.response?.data?.message || "Failed to connect to YouTube"
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUpload = async (videoId: string) => {
    // Do not proceed if YouTube is not connected
    if (!isYouTubeConnected) {
      toast.error("Please connect to YouTube first.");
      return;
    }

    // Set the videoId that's being uploaded
    setUploading(videoId);
    setShowUploadForm(null); // Reset upload form visibility

    try {
      // Get upload data from state
      const { title, description, tags, useThumbnail } = uploadData;

      if (!title) {
        toast.error("Title is required");
        setUploading(null);
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        setUploading(null);
        return;
      }

      // Send upload request to the server with video metadata
      const response = await axios({
        method: "POST",
        url: `${getAPIBaseURL()}/api/upload-to-youtube/${videoId}`,
        headers: {
          "x-access-token": token,
          "Content-Type": "application/json",
        },
        data: {
          title,
          description,
          tags: tags.split(",").map((tag) => tag.trim()),
          useThumbnail,
        },
      });

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
      } else {
        throw new Error(response.data.message || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading to YouTube:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload video to YouTube"
      );
    } finally {
      setUploading(null);
      setUploadData({
        title: "",
        description: "",
        tags: "",
        useThumbnail: false,
      });
    }
  };

  const handleDelete = async (videoId: string) => {
    // Check for authentication
    const token = localStorage.getItem("token") || "";
    const userData = localStorage.getItem("user");

    // Create a proper mock token if using demo mode
    if (!token && userData) {
      // This is a demo/development workaround
      localStorage.setItem("token", "demo-token-for-testing");
      console.log("Using demo token for delete operation");
    }

    // Final token check
    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      toast.error("Authentication required. Please log in.");
      navigate("/auth");
      return;
    }

    // Confirm deletion
    if (!window.confirm("Are you sure you want to delete this video?")) {
      return;
    }

    // Show loading state
    const toastId = toast.loading("Deleting video...");

    try {
      // Make API request with the correct endpoint
      const response = await axios({
        method: "DELETE",
        url: `${getAPIBaseURL()}/api/delete-video/${videoId}`,
        headers: {
          "x-access-token": currentToken,
          "Content-Type": "application/json",
        },
        // Set timeout to avoid hanging requests
        timeout: 10000,
      });

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
          const fallbackResponse = await axios({
            method: "DELETE",
            url: `${getAPIBaseURL()}/api/delete/${videoId}`,
            headers: {
              "x-access-token": currentToken,
              "Content-Type": "application/json",
            },
            timeout: 10000,
          });

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

  const handleShowUploadForm = (videoId: string) => {
    const video = videos.find((v) => v.id === videoId);
    if (video) {
      // Check if we have comprehensive_content available
      if (video.comprehensive_content) {
        // Use AI-generated title and description from comprehensive_content if available
        setUploadData({
          title:
            video.comprehensive_content.title ||
            `AI Short: ${video.original_prompt}`,
          description:
            video.comprehensive_content.description ||
            `AI-generated Short about ${video.original_prompt}`,
          tags: "shorts,AI,technology",
          useThumbnail: false, // Default to not using AI-generated thumbnail
        });
      } else {
        // Fallback to original prompt if no comprehensive_content
        setUploadData({
          title: `AI Short: ${video.original_prompt}`,
          description: `AI-generated Short about ${video.original_prompt}`,
          tags: "shorts,AI,technology",
          useThumbnail: false,
        });
      }
      setShowUploadForm(videoId);
    }
  };

  const handleOpenYouTube = (youtubeId: string) => {
    window.open(`https://youtube.com/watch?v=${youtubeId}`, "_blank");
  };

  // Update the fetchTrendingYouTubeShorts function to show loading state
  const fetchTrendingYouTubeShorts = useCallback(async () => {
    try {
      if (!isYouTubeConnected) return; // Only fetch if connected to YouTube

      setTrendingLoading(true); // Set loading state to true
      const token = localStorage.getItem("token");
      if (!token) return;

      // Call your backend API to fetch trending shorts
      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube-trending-shorts`,
        {
          headers: {
            "x-access-token": token,
          },
        }
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
        <Navbar username={username} />
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

      <Navbar username={username} />

      <main className="flex-grow pt-20 pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header section with title and search */}
          <GalleryHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isAuthenticated={isAuthenticated}
            youtubeAuthChecked={true}
            isYouTubeConnected={isYouTubeConnected}
            onConnectYouTube={connectYouTube}
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
        />
      )}

      <Footer />
    </div>
  );
}

export default GalleryPage;
