import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
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

// Lazy load non-critical components
const LazyVideoDialog = React.lazy(() => import("@/components/gallery/VideoDialog"));
const LazyUploadFormDialog = React.lazy(() => import("@/components/gallery/UploadFormDialog"));
const LazyYouTubeConnect = React.lazy(() => import("@/components/YouTubeConnect"));

// Helper function to detect if device is low-end
const isLowEndDevice = () => {
  return (
    navigator.hardwareConcurrency <= 4 || 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
};

function GalleryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isYouTubeConnected, setYouTubeConnected } =
    useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [demoVideos, setDemoVideos] = useState<DemoVideo[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<DemoVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(
    null
  );
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
  const [selectedYouTubeChannel, setSelectedYouTubeChannel] =
    useState<any>(null);
  const [isFetchingChannelData, setIsFetchingChannelData] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const [lastTrendingFetch, setLastTrendingFetch] = useState<number>(0);
  const [trendingRequestInProgress, setTrendingRequestInProgress] =
    useState(false);
  // Tracking visible videos for optimization
  const [visibleVideos, setVisibleVideos] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Track if component is mounted to avoid updates after unmount
  const isMounted = useRef(true);
  // Throttle video loading
  const loadingQueue = useRef<string[]>([]);
  const isProcessingQueue = useRef(false);
  
  // Cache for network requests
  const requestCache = useRef<Map<string, any>>(new Map());
  
  // Low-end device detection
  const isLowEnd = useRef(isLowEndDevice());

  // Debug auth status to console
  console.log("Gallery page loaded with auth status:", { 
    isAuthenticated, 
    isYouTubeConnected,
    hasToken: !!localStorage.getItem("token"),
    hasUser: !!localStorage.getItem("user")
  });

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
      // Check cache first
      const cacheKey = `youtube-auth-status-${token.substring(0, 10)}`;
      if (requestCache.current.has(cacheKey)) {
        const cachedData = requestCache.current.get(cacheKey);
        const cacheAge = Date.now() - cachedData.timestamp;
        // Use cache if less than 5 minutes old
        if (cacheAge < 300000) {
          toast.dismiss(toastId);
          handleAuthResponse(cachedData.data);
          setIsCheckingAuth(false);
          return;
        }
      }

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

      // Cache the response
      requestCache.current.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      handleAuthResponse(response.data);
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

  // Helper function to handle auth response
  const handleAuthResponse = (data: any) => {
    if (data.status === "success") {
      if (data.is_connected || data.authenticated) {
        setYouTubeConnected(true);
        toast.success("Successfully connected to YouTube!");
      } else {
        setYouTubeConnected(false);
        toast.error("YouTube connection failed. Please try again.");
      }
    } else {
      toast.error("Unable to verify YouTube connection status.");
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
      
      // Force loading to false for non-authenticated users
      setLoading(false);
    }
  }, [isAuthenticated, authCheckComplete, navigate]);

  // Add this before any useEffect
  useEffect(() => {
    // Force exit loading state after 5 seconds no matter what
    const emergencyTimeout = setTimeout(() => {
      console.log("Emergency timeout triggered to force exit loading state");
      setLoading(false);
      if (loading) {
        toast.error("Something went wrong while loading. Showing available content.");
      }
    }, 5000);

    return () => {
      clearTimeout(emergencyTimeout);
    };
  }, []);

  // Define observeVideoElements before using it in any effects
  // Observe new video elements when they're added to the DOM
  const observeVideoElements = useCallback(() => {
    if (!observerRef.current) return;
    
    console.log("Observing video elements");
    // Find all video containers and observe them
    const videoElements = document.querySelectorAll('[data-video-id]');
    videoElements.forEach(el => {
      observerRef.current?.observe(el);
    });
  }, []);

  // Simplified function to load demo videos from the known path
  const loadDemoVideos = useCallback((count = 6) => {
    const demos = [];
    // Use the direct path to the demo videos with the API base URL
    const apiBase = getAPIBaseURL();
    const demoPath = "/lazycreator-media/demo/";
    
    // Simple loop to generate demo video objects
    for (let i = 1; i <= count; i++) {
      demos.push({
        id: `demo${i}`,
        url: `${apiBase}${demoPath}demo${i}.mp4`,
        title: `Demo Short #${i}`,
      });
    }
    
    setDemoVideos(demos);
    console.log(`Loaded ${count} demo videos from ${apiBase}${demoPath}`);
  }, []);

  // Radically simplify the loading workflow to ensure we exit loading state
  useEffect(() => {
    const loadGallery = async () => {
      try {
        console.log("Starting gallery page loading sequence");
        setLoading(true);
        
        // Handle non-authenticated users immediately
        if (!isAuthenticated) {
          console.log("User not authenticated, showing explore section");
          setActiveSection("explore");
          setLoading(false);
          
          // Load demo videos for non-authenticated users with a smaller count
          loadDemoVideos(isLowEnd.current ? 3 : 6);
          return;
        }
        
        // For authenticated users, try to fetch their videos
        console.log("User authenticated, fetching videos");
        
        try {
          // Simple, direct API call
          const token = localStorage.getItem("token");
          if (!token) {
            throw new Error("No auth token found");
          }
          
          const response = await axios.get(`${getAPIBaseURL()}/api/gallery`, {
            headers: {
              "x-access-token": token,
              "Content-Type": "application/json"
            },
            timeout: 8000 // 8 second timeout
          });
          
          if (response.data && response.data.videos) {
            console.log(`Loaded ${response.data.videos.length} videos successfully`);
            setVideos(response.data.videos);
          } else {
            console.warn("API response missing videos array");
            setVideos([]);
          }
        } catch (error) {
          console.error("Failed to fetch videos:", error);
          toast.error("Couldn't load your videos. Please try again later.");
          setVideos([]);
        }
        
        // Load demo videos for all users
        loadDemoVideos(isLowEnd.current ? 3 : 6);
      } catch (e) {
        console.error("Unexpected error in gallery loading sequence:", e);
      } finally {
        // Always exit loading state
        console.log("Exiting loading state");
        setLoading(false);
      }
    };

    loadGallery();
    
    // Check YouTube auth status if needed
    const shouldCheck = localStorage.getItem("checkYouTubeAuth");
    if (shouldCheck === "true") {
      checkYouTubeAuth();
    }
  }, [isAuthenticated, loadDemoVideos]); // Add loadDemoVideos to dependencies

  // Re-observe video elements when videos or demo videos change
  useEffect(() => {
    if (videos.length > 0 || demoVideos.length > 0) {
      // Wait for DOM to update before observing
      const timer = setTimeout(() => {
        observeVideoElements();
      }, 250);
      
      return () => clearTimeout(timer);
    }
  }, [videos, demoVideos, observeVideoElements]);

  // Set up intersection observer for lazy loading videos
  useEffect(() => {
    // Set up the intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Create a batch update for better performance
        const newVisibleVideos = new Set(visibleVideos);
        let hasChanges = false;

        entries.forEach((entry) => {
          const videoId = entry.target.getAttribute("data-video-id");
          if (!videoId) return;

          if (entry.isIntersecting) {
            if (!newVisibleVideos.has(videoId)) {
              newVisibleVideos.add(videoId);
              hasChanges = true;
              
              // Add to loading queue if not already visible
              if (!loadingQueue.current.includes(videoId)) {
                loadingQueue.current.push(videoId);
              }
            }
          } else {
            if (newVisibleVideos.has(videoId)) {
              newVisibleVideos.delete(videoId);
              hasChanges = true;
            }
          }
        });

        // Only update state if there are changes
        if (hasChanges && isMounted.current) {
          setVisibleVideos(newVisibleVideos);
          processLoadingQueue();
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    // Start processing the loading queue
    processLoadingQueue();

    return () => {
      // Clean up the observer when component unmounts
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      isMounted.current = false;
    };
  }, []);

  // Function to process the video loading queue
  const processLoadingQueue = useCallback(() => {
    if (isProcessingQueue.current || loadingQueue.current.length === 0) return;
    
    isProcessingQueue.current = true;
    
    // Process at most 3 videos at a time to avoid overwhelming the browser
    const batchSize = isLowEnd.current ? 1 : 3;
    const batchToProcess = loadingQueue.current.splice(0, batchSize);
    
    // Set a timeout to process the next batch
    setTimeout(() => {
      isProcessingQueue.current = false;
      if (loadingQueue.current.length > 0) {
        processLoadingQueue();
      }
    }, isLowEnd.current ? 500 : 200);
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
      setDownloadingVideoId(videoId); // Set the downloading video ID
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
    } catch (error: any) {
      console.error("Error downloading video:", error);
      toast.error("Failed to download video");
    } finally {
      setDownloadingVideoId(null); // Clear the downloading state
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

  // Limit API requests for trending YouTube shorts with timestamp
  const fetchTrendingYouTubeShorts = useCallback(
    async (forceRefresh = false) => {
      try {
        // First check if connected to YouTube
        if (!isYouTubeConnected) {
          console.log(
            "Not connected to YouTube, skipping trending shorts fetch"
          );
          return;
        }

        // Check if we already have a request in progress
        if (trendingRequestInProgress) {
          console.log(
            "A trending shorts request is already in progress, skipping duplicate request"
          );
          return;
        }

        // Check if we need to refresh based on timestamp
        const now = Date.now();
        if (
          !forceRefresh &&
          lastTrendingFetch > 0 &&
          now - lastTrendingFetch < 3600000
        ) {
          console.log(
            "Using cached trending shorts, last fetched:",
            new Date(lastTrendingFetch).toLocaleTimeString()
          );
          return; // Use cached data if less than an hour has passed
        }

        // Additional check for loading state
        if (trendingLoading) {
          console.log(
            "Already loading trending videos, skipping duplicate request"
          );
          return;
        }

        // Set both flags to prevent concurrent requests
        setTrendingRequestInProgress(true);
        setTrendingLoading(true);

        console.log(
          "Fetching new trending shorts at:",
          new Date().toLocaleTimeString()
        );

        try {
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
              console.log(`Setting ${trendingShorts.length} trending shorts`);
              // Set trending videos in separate state
              setTrendingVideos([...trendingShorts]);
              // Update last fetch timestamp
              setLastTrendingFetch(now);
            } else {
              console.log("No trending shorts returned from API");
            }
          } else {
            console.log("Invalid trending shorts response:", response.data);
          }
        } catch (error) {
          console.error("Error fetching trending shorts:", error);
          // Don't clear trending videos on error - keep the existing ones
        } finally {
          // Clear both flags
          setTrendingLoading(false);
          setTrendingRequestInProgress(false);
        }
      } catch (outerError) {
        console.error(
          "Unexpected error in fetchTrendingYouTubeShorts:",
          outerError
        );
        setTrendingLoading(false);
        setTrendingRequestInProgress(false);
      }
    },
    [
      isYouTubeConnected,
      lastTrendingFetch,
      trendingLoading,
      trendingRequestInProgress,
    ]
  );

  // Fetch trending shorts when YouTube is connected or when active section changes
  useEffect(() => {
    if (isYouTubeConnected && activeSection === "explore") {
      console.log("YouTube is connected, fetching trending shorts");
      // Delay the initial fetch to avoid multiple calls during component mount
      const timer = setTimeout(() => {
        fetchTrendingYouTubeShorts(true); // Force refresh when active section changes
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isYouTubeConnected, activeSection, fetchTrendingYouTubeShorts]);

  // Set up interval to check for hourly updates when the component is mounted
  useEffect(() => {
    // Only set up interval if we're on explore section and connected to YouTube
    if (activeSection === "explore" && isYouTubeConnected) {
      const checkInterval = setInterval(() => {
        fetchTrendingYouTubeShorts();
      }, 300000); // Check every 5 minutes (300000ms)

      return () => clearInterval(checkInterval);
    }
  }, [activeSection, isYouTubeConnected, fetchTrendingYouTubeShorts]);

  // Updated handleDemoVideoClick to include error handling
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
        // Add error handling for video loading
        videoElement.onerror = () => {
          console.error(`Failed to load demo video: ${demo.url}`);
          // Show error UI in the video element
          const container = videoElement.parentElement;
          if (container) {
            // Create error overlay
            const errorDiv = document.createElement('div');
            errorDiv.className = 'absolute inset-0 flex items-center justify-center bg-black/80 text-white text-center p-4';
            errorDiv.innerHTML = `
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>Failed to load video</p>
              </div>
            `;
            container.appendChild(errorDiv);
          }
        };
        
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

  // Optimized video rendering with visibility check
  const shouldRenderVideo = useCallback((videoId: string) => {
    return visibleVideos.has(videoId);
  }, [visibleVideos]);

  // Forward the visibility check to child components
  const enhancedMyVideosProps = {
    videos,
    loading,
    searchQuery,
    isYouTubeConnected,
    onCreateNew: () => navigate("/create"),
    onVideoClick: setActiveVideo,
    onDownload: handleDownload,
    onDelete: handleDelete,
    onShowUploadForm: handleShowUploadForm,
    onConnectYouTube: connectYouTube,
    onOpenYouTube: handleOpenYouTube,
    onClearSearch: () => setSearchQuery(""),
    isAuthenticated,
    downloadingVideoId,
    shouldRenderVideo,
  };

  const enhancedExploreSectionProps = {
    demoVideos,
    trendingVideos,
    trendingLoading,
    isYouTubeConnected,
    onDemoVideoClick: handleDemoVideoClick,
    onRefreshTrending: () => {
      console.log("Refresh trending videos requested");
      return fetchTrendingYouTubeShorts(true);
    },
    shouldRenderVideo,
  };

  // Add a check that combines loading state with authentication context
  const isActuallyLoading = loading && (isAuthenticated || activeSection !== "explore");

  if (loading) {
    console.log("Rendering loading state");
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
            <button 
              onClick={() => setLoading(false)}
              className="text-xs text-primary mt-4 underline"
            >
              Click here if loading takes too long
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
            <MyVideosSection {...enhancedMyVideosProps} />
          )}

          {/* Explore Section */}
          {activeSection === "explore" && (
            <ExploreSection {...enhancedExploreSectionProps} />
          )}
        </div>
      </main>

      {/* Use Suspense for lazily loaded components */}
      <Suspense fallback={null}>
        {activeVideo && (
          <LazyVideoDialog
            video={activeVideo}
            isYouTubeConnected={isYouTubeConnected}
            onClose={() => setActiveVideo(null)}
            onDownload={handleDownload}
            onShowUploadForm={handleShowUploadForm}
            onOpenYouTube={handleOpenYouTube}
          />
        )}

        {showUploadForm && (
          <LazyUploadFormDialog
            videoId={showUploadForm}
            isUploading={uploading === showUploadForm}
            uploadData={uploadData}
            generatedContent={videos.find(v => v.id === showUploadForm)?.comprehensive_content}
            onUploadDataChange={setUploadData}
            onClose={() => setShowUploadForm(null)}
            onUpload={handleUpload}
            youtubeChannels={youtubeChannels}
          />
        )}

        {showYouTubeConnectModal && (
          <LazyYouTubeConnect
            visible={showYouTubeConnectModal}
            onClose={() => setShowYouTubeConnectModal(false)}
            onConnectionChange={(connected) => {
              setYouTubeConnected(connected);
              if (connected) {
                fetchYouTubeChannels();
              }
            }}
            onChannelSelect={(channel) => {
              setSelectedYouTubeChannel(channel);
            }}
            selectedChannelId={selectedYouTubeChannel?.id}
          />
        )}
      </Suspense>

      <Footer />
    </div>
  );
}

export default GalleryPage;
