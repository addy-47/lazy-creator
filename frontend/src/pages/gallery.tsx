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
  const { isAuthenticated, username } = useContext(AuthContext);
  const [videos, setVideos] = useState<Video[]>([]);
  const [demoVideos, setDemoVideos] = useState<DemoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [youtubeAuthChecked, setYoutubeAuthChecked] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadData>({
    title: "",
    description: "",
    tags: "",
  });
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [activeSection, setActiveSection] = useState<"my-videos" | "explore">(
    "my-videos"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [trendingLoading, setTrendingLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get authentication token
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("Authentication token missing");
          setLoading(false);
          return;
        }

        const response = await axios.get(`${getAPIBaseURL()}/api/gallery`, {
          headers: {
            "x-access-token": token,
          },
        });

        if (response.data && response.data.videos) {
          setVideos(response.data.videos);
        }
      } catch (error) {
        console.error("Error fetching videos:", error);
        toast.error("Error loading your gallery");
      } finally {
        setLoading(false);
      }
    };

    const checkYouTubeAuth = async () => {
      try {
        // Check for authentication
        const token = localStorage.getItem("token") || "";
        const userData = localStorage.getItem("user");

        // Create a proper mock token if using demo mode
        if (!token && userData) {
          // This is a demo/development workaround
          localStorage.setItem("token", "demo-token-for-testing");
          console.log("Using demo token for YouTube auth check");
        }

        // Final token check
        const currentToken = localStorage.getItem("token");

        if (!currentToken) {
          setYoutubeAuthChecked(true);
          setIsYouTubeConnected(false);
          return;
        }

        const response = await axios({
          method: "GET",
          url: `${getAPIBaseURL()}/api/youtube-auth-status`,
          headers: {
            "x-access-token": currentToken,
            "Content-Type": "application/json",
          },
          timeout: 5000,
        });

        if (response.data.status === "success") {
          setIsYouTubeConnected(response.data.authenticated);
        }
        setYoutubeAuthChecked(true);
      } catch (error) {
        console.error("Error checking YouTube auth:", error);
        setYoutubeAuthChecked(true);
        setIsYouTubeConnected(false);
      }
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
    checkYouTubeAuth();
  }, []);

  // Check authentication status when returning from YouTube auth
  useEffect(() => {
    const checkAuthAfterRedirect = async () => {
      const shouldCheck = localStorage.getItem("checkYouTubeAuth");

      if (shouldCheck === "true") {
        // Clear the flag
        localStorage.removeItem("checkYouTubeAuth");

        // Wait a bit to ensure the auth process completed
        setTimeout(async () => {
          try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const response = await axios.get(
              `${getAPIBaseURL()}/api/youtube-auth-status`,
              {
                headers: {
                  "x-access-token": token,
                },
              }
            );

            if (response.data.status === "success") {
              setIsYouTubeConnected(response.data.authenticated);

              if (response.data.authenticated) {
                toast.success("YouTube connected successfully!");
              } else {
                toast.error("YouTube connection failed. Please try again.");
              }
            }
          } catch (error) {
            console.error("Error checking YouTube auth after redirect:", error);
          }
        }, 2000);
      }
    };

    checkAuthAfterRedirect();
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
    // Check for authentication
    const token = localStorage.getItem("token") || "";
    const userData = localStorage.getItem("user");

    // Create a proper mock token if using demo mode
    if (!token && userData) {
      // This is a demo/development workaround
      localStorage.setItem("token", "demo-token-for-testing");
      console.log("Using demo token for YouTube connection");
    }

    // Final token check
    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      toast.error("Authentication required. Please log in.");
      navigate("/auth");
      return;
    }

    // Show loading state
    const toastId = toast.loading("Connecting to YouTube...");

    try {
      // Make API request
      const response = await axios({
        method: "GET",
        url: `${getAPIBaseURL()}/api/youtube-auth-start`,
        headers: {
          "x-access-token": currentToken,
          "Content-Type": "application/json",
        },
        params: {
          redirect_uri: `${window.location.origin}/youtube-auth-callback`,
        },
        // Set timeout to avoid hanging requests
        timeout: 10000,
      });

      toast.dismiss(toastId);

      // Handle success
      if (response.data.status === "success" && response.data.auth_url) {
        // Open the auth URL in a new window with appropriate size
        const authWindow = window.open(
          response.data.auth_url,
          "_blank",
          "width=800,height=600,scrollbars=yes"
        );

        // Check if popup was blocked
        if (!authWindow) {
          toast.error(
            "Popup blocked! Please allow popups for this site and try again."
          );
          return;
        }

        // Set flag to check auth status after user returns
        localStorage.setItem("checkYouTubeAuth", "true");

        toast.info("Please complete authentication in the opened window", {
          duration: 5000,
        });
      } else {
        console.error("YouTube auth response:", response.data);
        toast.error(
          response.data.message || "Failed to start YouTube authentication"
        );
      }
    } catch (error: any) {
      toast.dismiss(toastId);

      console.error("YouTube auth error:", error);

      // Check specific error conditions
      if (error.response) {
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
        toast.error("No response from server. Please check your connection.");
      } else {
        // Error in request setup
        toast.error("Error sending request. Please try again.");
      }
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
      const { title, description, tags } = uploadData;

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
      // Set default title and description based on the video
      setUploadData({
        title: `AI Short: ${video.original_prompt}`,
        description: `AI-generated Short about ${video.original_prompt}`,
        tags: "shorts,AI,technology",
      });
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
            youtubeAuthChecked={youtubeAuthChecked}
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
              onCreateNew={() => navigate("/create")}
              onVideoClick={setActiveVideo}
              onDownload={handleDownload}
              onShowUploadForm={() => {
                // Using a mock function that takes no parameters
                // The actual implementation in VideoCard component will pass the videoId
                if (activeVideo) {
                  handleShowUploadForm(activeVideo.id);
                }
              }}
              onConnectYouTube={connectYouTube}
              onOpenYouTube={handleOpenYouTube}
              onDelete={handleDelete}
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
