import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/Button";
import { toast } from "sonner";
import {
  Youtube,
  Plus,
  Film,
  SearchIcon,
  Sparkles,
  Download,
} from "lucide-react";
import { AuthContext } from "../App";
import VideoActionMenu from "@/components/VideoActionMenu";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { useNavigate, useLocation } from "react-router-dom";
import { getAPIBaseURL } from "@/lib/socket";

interface Video {
  id: string;
  filename: string;
  original_prompt: string;
  duration: number;
  created_at: string;
  uploaded_to_yt: boolean;
  youtube_id: string | null;
}

function GalleryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, username } = useContext(AuthContext);
  const [videos, setVideos] = useState<Video[]>([]);
  const [demoVideos, setDemoVideos] = useState<{ id: string; url: string }[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [youtubeAuthChecked, setYoutubeAuthChecked] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState({
    title: "",
    description: "",
    tags: "",
  });
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [activeSection, setActiveSection] = useState<"my-videos" | "explore">(
    "my-videos"
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${getAPIBaseURL()}/api/gallery`);
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
      { id: "demo1", url: `${getAPIBaseURL()}/demo/demo1.mp4` },
      { id: "demo2", url: `${getAPIBaseURL()}/demo/demo2.mp4` },
      { id: "demo3", url: `${getAPIBaseURL()}/demo/demo3.mp4` },
      { id: "demo4", url: `${getAPIBaseURL()}/demo/demo4.mp4` },
      { id: "demo5", url: `${getAPIBaseURL()}/demo/demo5.mp4` },
      { id: "demo6", url: `${getAPIBaseURL()}/demo/demo6.mp4` },
    ]);

    fetchData();
    checkYouTubeAuth();
  }, []);

  // Add effect to check authentication status when returning from YouTube auth
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
      const response = await axios.get(
        `${getAPIBaseURL()}/api/download/${videoId}`,
        {
          responseType: "blob",
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
    setUploading(videoId);

    // Check for authentication
    const token = localStorage.getItem("token") || "";
    const userData = localStorage.getItem("user");

    // Create a proper mock token if using demo mode
    if (!token && userData) {
      // This is a demo/development workaround
      localStorage.setItem("token", "demo-token-for-testing");
      console.log("Using demo token for YouTube upload");
    }

    // Final token check
    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      setUploading(null);
      toast.error("Authentication required. Please log in.");
      navigate("/auth");
      return;
    }

    // Prepare tags as array if provided
    const tags = uploadData.tags
      ? uploadData.tags.split(",").map((tag) => tag.trim())
      : [];

    // Show loading state
    const toastId = toast.loading("Uploading to YouTube...");

    try {
      // Make API request
      const response = await axios({
        method: "POST",
        url: `${getAPIBaseURL()}/api/upload-to-youtube/${videoId}`,
        headers: {
          "x-access-token": currentToken,
          "Content-Type": "application/json",
        },
        data: {
          title: uploadData.title,
          description: uploadData.description,
          tags: tags,
        },
        // Set timeout to avoid hanging requests
        timeout: 30000, // Longer timeout for uploads
      });

      toast.dismiss(toastId);

      // Handle success
      if (response.data.status === "success") {
        toast.success("Video uploaded to YouTube successfully!");

        // Update the video in the list to show YouTube badge
        setVideos((prev) =>
          prev.map((video) =>
            video.id === videoId
              ? {
                  ...video,
                  uploaded_to_yt: true,
                  youtube_id: response.data.youtube_id,
                }
              : video
          )
        );

        // Hide the upload form
        setShowUploadForm(null);
      } else {
        console.error("Upload response:", response.data);
        toast.error(response.data.message || "Upload failed");
      }
    } catch (error: any) {
      toast.dismiss(toastId);

      console.error("Upload error:", error);

      // Check specific error conditions
      if (error.response) {
        // YouTube authentication error
        if (error.response.data?.require_auth) {
          toast.error(
            "YouTube authentication required. Please connect your account first."
          );
          // Show the YouTube connect button
          setIsYouTubeConnected(false);
        }
        // Session authentication error
        else if (
          error.response.status === 401 ||
          error.response.status === 403
        ) {
          toast.error("Session expired. Please log in again.");
          localStorage.removeItem("token");
          navigate("/auth");
        }
        // Other server errors
        else {
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
    } finally {
      setUploading(null);
      // Reset upload form
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

  // Filter videos based on search query
  const filteredVideos = videos.filter((video) =>
    video.original_prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Standardized card width for consistent layout
  const cardWidthClass = "w-full";
  const cardClass = "aspect-[9/16] rounded-xl overflow-hidden";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-background/95">
      {/* Background pattern */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.03]"></div>

      <Navbar username={username} />

      <main className="flex-grow pt-20 pb-20 px-4">
        <div className="container mx-auto max-w-7xl">
          {/* Header section with title and search */}
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 py-2 pr-4 rounded-full bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none w-full sm:w-64"
                />
              </div>

              {/* YouTube connect button */}
              {isAuthenticated && youtubeAuthChecked && !isYouTubeConnected && (
                <Button
                  onClick={connectYouTube}
                  className="flex items-center gap-2 rounded-full"
                  variant="outline"
                >
                  <Youtube size={16} />
                  Connect YouTube
                </Button>
              )}
            </div>
          </div>

          {/* Gallery Tab navigation */}
          <div className="mb-8 border-b">
            <div className="flex space-x-6">
              <button
                onClick={() => setActiveSection("my-videos")}
                className={`pb-2 px-1 font-medium relative ${
                  activeSection === "my-videos"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                My Videos
                {activeSection === "my-videos" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>

              <button
                onClick={() => setActiveSection("explore")}
                className={`pb-2 px-1 font-medium relative flex items-center gap-1 ${
                  activeSection === "explore"
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Explore</span>
                <Sparkles size={14} className="opacity-70" />
                {activeSection === "explore" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* My Videos Section */}
          {activeSection === "my-videos" && (
            <div className="space-y-10">
              {/* My Videos Grid */}
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                  {/* Create New Button */}
                  <div className={cardWidthClass}>
                    <div
                      className={`${cardClass} bg-gradient-to-br from-primary/5 via-background to-secondary/5 border border-primary/10 flex flex-col items-center justify-center cursor-pointer hover:from-primary/10 hover:to-secondary/10 transition-all duration-300 hover:shadow-md hover:shadow-primary/5 group relative`}
                      onClick={() => navigate("/create")}
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.07]"></div>

                      <div className="p-3 rounded-full bg-primary/10 mb-3 group-hover:scale-110 transition-transform duration-300">
                        <Plus size={30} className="text-primary" />
                      </div>
                      <p className="text-base font-medium">Create New</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Add a new short
                      </p>
                    </div>
                  </div>

                  {/* User Videos */}
                  {filteredVideos.length === 0 ? (
                    searchQuery ? (
                      <div className={cardWidthClass}>
                        <div
                          className={`${cardClass} bg-muted/10 border border-dashed border-muted flex flex-col items-center justify-center p-4`}
                        >
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-3">
                              No videos matching your search
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSearchQuery("")}
                            >
                              Clear search
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null
                  ) : (
                    filteredVideos.map((video) => (
                      <div key={video.id} className={cardWidthClass}>
                        <div
                          className={`${cardClass} bg-black group cursor-pointer relative shadow-sm hover:shadow-md transition-shadow duration-300`}
                          onClick={() => setActiveVideo(video)}
                        >
                          {/* Video Action Menu */}
                          <VideoActionMenu
                            videoId={video.id}
                            isYouTubeConnected={isYouTubeConnected}
                            isUploaded={video.uploaded_to_yt}
                            youtubeId={video.youtube_id}
                            onDownload={handleDownload}
                            onShowUploadForm={() =>
                              handleShowUploadForm(video.id)
                            }
                            onConnectYouTube={connectYouTube}
                            onOpenYouTube={handleOpenYouTube}
                            onDelete={handleDelete}
                          />

                          {/* Video Thumbnail */}
                          <video
                            src={`${getAPIBaseURL()}/gallery/${video.filename}`}
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />

                          {/* YouTube badge if uploaded */}
                          {video.uploaded_to_yt && (
                            <div className="absolute top-3 right-3 bg-red-600 text-white text-xs py-0.5 px-2 rounded-full flex items-center gap-1">
                              <Youtube size={10} />
                              <span>YouTube</span>
                            </div>
                          )}

                          {/* Play Icon Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-3 rounded-full bg-background/80 backdrop-blur-sm transform group-hover:scale-110 transition-transform duration-300">
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-primary"
                              >
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </div>
                          </div>

                          {/* Video Info Overlay */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <p className="text-white text-sm font-medium line-clamp-2">
                              {video.original_prompt}
                            </p>
                            <p className="text-white/70 text-xs mt-1 flex items-center">
                              <span className="inline-block h-1 w-1 rounded-full bg-primary mr-2"></span>
                              {new Date(video.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Explore Section */}
          {activeSection === "explore" && (
            <div className="space-y-10">
              {/* Demo Videos Grid */}
              <div>
                <h2 className="text-xl font-medium mb-5 flex items-center gap-2">
                  <Film size={18} />
                  <span>Featured Demos</span>
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                  {demoVideos.map((demo) => (
                    <div key={demo.id} className={cardWidthClass}>
                      <div
                        className={`${cardClass} bg-black group relative shadow-sm hover:shadow-md transition-shadow duration-300`}
                      >
                        <video
                          src={demo.url}
                          className="w-full h-full object-cover"
                          muted
                          autoPlay
                          loop
                        />

                        {/* Video gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-70"></div>

                        {/* Demo badge */}
                        <div className="absolute top-3 right-3 bg-primary/80 text-white text-xs py-0.5 px-2 rounded-full">
                          Demo
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Horizontal showcase section with moving cards */}
              <div>
                <h2 className="text-xl font-medium mb-5 flex items-center gap-2">
                  <Sparkles size={18} />
                  <span>Trending Shorts</span>
                </h2>

                <div className="h-[400px] overflow-hidden rounded-xl bg-gradient-to-b from-background/50 to-background/20 border border-border/20 p-2">
                  <InfiniteMovingCards
                    items={demoVideos.map((demo) => ({
                      id: demo.id,
                      content: (
                        <div className="w-[200px] h-[330px] mx-2 relative group">
                          <div
                            className={`${cardClass} bg-black shadow-lg h-full w-full`}
                          >
                            <video
                              src={demo.url}
                              className="w-full h-full object-cover"
                              muted
                              autoPlay
                              loop
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <div className="text-white text-sm font-medium mb-1 truncate">
                                Creative Short #{demo.id.replace("demo", "")}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                    <Film size={12} className="text-primary" />
                                  </div>
                                  <span className="text-white/70 text-xs ml-1.5">
                                    Trending
                                  </span>
                                </div>
                                <div className="text-white/70 text-xs">
                                  {Math.floor(Math.random() * 50) + 10}K views
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ),
                    }))}
                    direction="left"
                    speed="slow"
                    pauseOnHover
                    className="py-4"
                    itemClassName="cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Video Popup Dialog */}
      {activeVideo && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setActiveVideo(null)}
        >
          <div
            className="bg-card max-w-2xl w-full p-4 rounded-2xl shadow-xl animate-scale-in border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${cardClass} bg-black mb-4`}>
              <video
                src={`${getAPIBaseURL()}/gallery/${activeVideo.filename}`}
                className="w-full h-full object-contain"
                controls
                autoPlay
              />
            </div>

            <div className="px-2 pb-3">
              <h3 className="text-xl font-medium line-clamp-2 mb-2 mt-1">
                {activeVideo.original_prompt}
              </h3>
              <p className="text-sm text-foreground/70 mb-6">
                Created: {new Date(activeVideo.created_at).toLocaleString()}
              </p>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={() => setActiveVideo(null)}
                  className="rounded-full"
                >
                  Close
                </Button>
                <Button
                  onClick={() => handleDownload(activeVideo.id)}
                  className="rounded-full"
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
                {!activeVideo.uploaded_to_yt && isYouTubeConnected && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleShowUploadForm(activeVideo.id);
                      setActiveVideo(null);
                    }}
                    className="rounded-full"
                  >
                    <Youtube size={16} className="mr-2" />
                    Upload to YouTube
                  </Button>
                )}
                {activeVideo.uploaded_to_yt && activeVideo.youtube_id && (
                  <Button
                    variant="outline"
                    onClick={() => handleOpenYouTube(activeVideo.youtube_id!)}
                    className="rounded-full"
                  >
                    <Youtube size={16} className="mr-2" />
                    View on YouTube
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Upload Form Dialog */}
      {showUploadForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card max-w-md w-full p-6 rounded-2xl shadow-xl animate-scale-in border border-border">
            <h3 className="text-xl font-semibold mb-6">Upload to YouTube</h3>

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium block mb-2">Title</label>
                <input
                  type="text"
                  value={uploadData.title}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, title: e.target.value })
                  }
                  className="w-full p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Description
                </label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) =>
                    setUploadData({
                      ...uploadData,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={uploadData.tags}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, tags: e.target.value })
                  }
                  className="w-full p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => setShowUploadForm(null)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                onClick={() => showUploadForm && handleUpload(showUploadForm)}
                disabled={uploading !== null}
                className="rounded-full"
              >
                {uploading === showUploadForm ? (
                  <>
                    <div className="h-4 w-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Youtube size={16} className="mr-2" />
                    Upload
                  </>
                )}
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
