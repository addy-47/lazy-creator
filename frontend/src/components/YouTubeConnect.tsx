import React, { useState, useEffect } from "react";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";
import { toast } from "sonner";
import {
  Youtube,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/Button";
import { motion } from "framer-motion";

interface Channel {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnailUrl?: string;
}

interface YouTubeConnectProps {
  onConnectionChange?: (connected: boolean) => void;
  onChannelSelect?: (channel: Channel) => void;
  selectedChannelId?: string;
  visible?: boolean;
  onClose?: () => void;
}

const YouTubeConnect: React.FC<YouTubeConnectProps> = ({
  onConnectionChange,
  onChannelSelect,
  selectedChannelId,
  visible,
  onClose,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Check connection status on mount
  useEffect(() => {
    console.log("YouTubeConnect mounted or visibility changed");
    // Only check on initial mount, not on every visibility change
    // to prevent infinite loops
    checkConnectionStatus(false);
  }, []);

  // Fetch channels when connection status changes
  useEffect(() => {
    console.log("Connection status changed:", isConnected);
    if (isConnected && channels.length === 0) {
      console.log("Connected but no channels loaded, fetching channels now");
      fetchChannels();
    }
  }, [isConnected]);

  // Set selected channel from prop if provided
  useEffect(() => {
    if (selectedChannelId && channels.length > 0) {
      const channel = channels.find((c) => c.id === selectedChannelId);
      if (channel) {
        setSelectedChannel(channel);
      }
    } else if (channels.length > 0 && !selectedChannel) {
      // Auto-select first channel if none is selected
      setSelectedChannel(channels[0]);
      if (onChannelSelect) {
        onChannelSelect(channels[0]);
      }
    }
  }, [channels, selectedChannelId, onChannelSelect, selectedChannel]);

  // Add event listener for messages from the popup window
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // Verify the origin to ensure it's from our application
      if (event.origin !== window.location.origin) return;

      // Check if this is our auth success message
      if (event.data && event.data.type === "youtube_auth_success") {
        console.log("Received auth success message:", event.data);

        // Close the auth window if it's still open
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }

        // Update connection status
        if (event.data.success) {
          toast.success("Successfully connected to YouTube!");
          setIsConnected(true);
          if (onConnectionChange) onConnectionChange(true);
          // Fetch channels after successful connection
          fetchChannels();
        } else {
          toast.error(
            "YouTube connection failed: " +
              (event.data.error || "Unknown error")
          );
          setErrorMessage(event.data.error || "Failed to connect to YouTube");
        }

        setIsConnecting(false);
      }
    };

    // Add event listener
    window.addEventListener("message", handleAuthMessage);

    // Cleanup
    return () => {
      window.removeEventListener("message", handleAuthMessage);
    };
  }, [authWindow, onConnectionChange]);

  // Function to check YouTube connection status
  const checkConnectionStatus = async (shouldFetchChannels = true) => {
    setLoadingStatus(true);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoadingStatus(false);
        setErrorMessage("Authentication required. Please log in.");
        return;
      }

      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube-auth-status`,
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      if (response.data.status === "success") {
        const connected =
          response.data.is_connected || response.data.authenticated;
        setIsConnected(connected);

        console.log("YouTube connection status:", {
          connected,
          isConnected: connected,
          responseData: response.data,
        });

        if (connected) {
          if (onConnectionChange) onConnectionChange(true);
          // Only fetch channels if flag is true to prevent loops
          if (shouldFetchChannels && channels.length === 0) {
            fetchChannels();
          }
        }
      }
    } catch (error) {
      console.error("Error checking YouTube connection:", error);
      setErrorMessage("Failed to check YouTube connection status");
    } finally {
      setLoadingStatus(false);
    }
  };

  // Function to fetch YouTube channels
  const fetchChannels = async () => {
    // If we're already loading channels, prevent duplicate requests
    if (loadingChannels) return;

    setLoadingChannels(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoadingChannels(false);
        return;
      }

      console.log("Fetching YouTube channels...");

      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube/channels`,
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      console.log(
        "YouTube channels response data:",
        JSON.stringify(response.data)
      );

      if (response.data.status === "success" && response.data.channels) {
        console.log(
          `Found ${response.data.channels.length} channels:`,
          response.data.channels
        );

        // Only update if we actually have channels and there's a change
        if (response.data.channels.length > 0) {
          setChannels(response.data.channels);

          // Check if we need to restore the selected channel
          const savedChannelId = localStorage.getItem("selectedYouTubeChannel");
          if (savedChannelId) {
            const savedChannel = response.data.channels.find(
              (c: Channel) => c.id === savedChannelId
            );
            if (savedChannel) {
              setSelectedChannel(savedChannel);
              // Only call onChannelSelect if the selected channel has changed
              if (!selectedChannel || selectedChannel.id !== savedChannel.id) {
                if (onChannelSelect) onChannelSelect(savedChannel);
              }
            } else {
              // If saved channel not found, use first channel
              setSelectedChannel(response.data.channels[0]);
              // Only call onChannelSelect if the selected channel has changed
              if (
                !selectedChannel ||
                selectedChannel.id !== response.data.channels[0].id
              ) {
                if (onChannelSelect) onChannelSelect(response.data.channels[0]);
              }
            }
          } else {
            // Auto-select first channel if none selected
            setSelectedChannel(response.data.channels[0]);
            // Only call onChannelSelect if the selected channel has changed
            if (
              !selectedChannel ||
              selectedChannel.id !== response.data.channels[0].id
            ) {
              if (onChannelSelect) onChannelSelect(response.data.channels[0]);
            }
          }
        } else {
          console.warn("API returned success but no channels found");
          // Force a reconnect attempt if no channels found
          if (isConnected) {
            console.log(
              "Connected but no channels found. This might be an API issue."
            );
          }
        }
      } else {
        console.error(
          "Invalid API response format or no channels returned",
          response.data
        );
      }
    } catch (error: any) {
      console.error("Error fetching channels:", error);
      // Add more detailed error logging
      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
      }
    } finally {
      setLoadingChannels(false);
    }
  };

  // Function to select a channel
  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    localStorage.setItem("selectedYouTubeChannel", channel.id);
    if (onChannelSelect) onChannelSelect(channel);
  };

  // Function to initiate YouTube connection
  const connectToYouTube = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    setErrorMessage(null);
    const toastId = toast.loading("Connecting to YouTube...");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.dismiss(toastId);
        toast.error("Authentication required. Please log in.");
        setErrorMessage("Authentication required. Please log in.");
        setIsConnecting(false);
        return;
      }

      // Step 1: Get YouTube auth URL
      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube/auth/start`,
        {
          headers: {
            "x-access-token": token,
          },
          params: {
            redirect_uri: `${window.location.origin}/youtube-auth-success`,
          },
        }
      );

      if (response.data.status === "success" && response.data.auth_url) {
        toast.dismiss(toastId);
        toast.info("Opening YouTube authentication...");

        // Extract the state parameter from the auth_url
        const urlObj = new URL(response.data.auth_url);
        const state = urlObj.searchParams.get("state");

        // Store state in localStorage to verify later
        if (state) {
          localStorage.setItem("youtube_auth_state", state);
        }

        // Step 2: Open auth URL in a popup window
        const authPopup = window.open(
          response.data.auth_url,
          "YouTube Authentication",
          "width=800,height=600"
        );

        if (authPopup) {
          setAuthWindow(authPopup);

          // Step 3: Poll for connection status
          const checkInterval = setInterval(() => {
            if (authPopup.closed) {
              clearInterval(checkInterval);

              // Wait a moment then check auth status
              setTimeout(() => {
                checkConnectionStatus();
                toast.success(
                  "YouTube authentication window closed. Checking connection status..."
                );
              }, 2000);
            }
          }, 500);
        } else {
          toast.error(
            "Unable to open authentication window. Please enable popups."
          );
          setIsConnecting(false);
        }
      } else {
        toast.dismiss(toastId);
        toast.error("Failed to start YouTube authentication");
        setErrorMessage("Failed to get authentication URL");
        setIsConnecting(false);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      console.error("Error connecting to YouTube:", error);

      // Extract and show error message
      const errorMsg =
        error.response?.data?.message || "Failed to connect to YouTube";
      toast.error(errorMsg);
      setErrorMessage(errorMsg);
      setIsConnecting(false);
    }
  };

  // Add a forceRefresh function
  const forceRefresh = () => {
    console.log("Force refreshing YouTube connect status...");
    checkConnectionStatus();
  };

  // Render the component
  if (loadingStatus) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
        <p>Checking YouTube connection...</p>
      </div>
    );
  }

  if (isConnected) {
    console.log("Rendering connected state, channels:", channels);
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 text-green-500">
          <Youtube size={20} />
          <span className="font-medium">
            Your YouTube account is connected!
          </span>
        </div>

        {loadingChannels ? (
          <div className="mt-4 p-4 text-center">
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading channels...</p>
          </div>
        ) : channels.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center">
              <span>Your YouTube Channels</span>
              {channels.length > 1 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (Click to switch)
                </span>
              )}
            </h3>
            <ul className="space-y-2 rounded-lg overflow-hidden border border-border">
              {channels.map((channel) => (
                <motion.li
                  key={channel.id}
                  className={`flex items-center gap-2 p-3 rounded-md cursor-pointer transition-colors
                    ${
                      selectedChannel?.id === channel.id
                        ? "bg-primary-foreground/10 border-l-2 border-primary"
                        : "bg-background/30 hover:bg-primary-foreground/5"
                    }`}
                  onClick={() => handleChannelSelect(channel)}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex-shrink-0">
                    {channel.thumbnailUrl ? (
                      <img
                        src={channel.thumbnailUrl}
                        alt={channel.title}
                        className="w-10 h-10 rounded-full border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Youtube size={16} className="text-primary" />
                      </div>
                    )}
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {channel.title}
                      </p>
                      {selectedChannel?.id === channel.id && (
                        <CheckCircle2
                          size={16}
                          className="text-primary flex-shrink-0 ml-2"
                        />
                      )}
                    </div>
                    {channel.customUrl && (
                      <p className="text-xs text-muted-foreground truncate">
                        @{channel.customUrl}
                      </p>
                    )}
                  </div>

                  {channels.length > 1 && (
                    <ChevronRight
                      size={14}
                      className={`flex-shrink-0
                      ${
                        selectedChannel?.id === channel.id
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  )}
                </motion.li>
              ))}
            </ul>

            {selectedChannel && (
              <div className="mt-3 p-2 text-xs text-center text-muted-foreground">
                Selected channel:{" "}
                <span className="font-medium">{selectedChannel.title}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 p-3 bg-amber-100/20 border border-amber-200/30 rounded-lg text-sm">
            <p className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Info size={16} />
              <span>
                No YouTube channels found. Make sure you have at least one
                channel on your YouTube account.
              </span>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      {errorMessage && (
        <div className="text-red-500 mb-4 text-sm p-3 bg-red-500/5 rounded-lg border border-red-200/20">
          <p className="mb-2">{errorMessage}</p>
          <Button
            onClick={forceRefresh}
            variant="outline"
            className="text-xs px-2 py-1 h-auto mt-1"
          >
            Retry Connection Check
          </Button>
        </div>
      )}

      <Button
        size="lg"
        variant="outline"
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#800000] to-[#E0115F] hover:from-[#800000]/90 hover:to-[#E0115F]/90 text-white border-transparent"
        onClick={connectToYouTube}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Youtube className="h-5 w-5" />
        )}
        <span>{isConnecting ? "Connecting..." : "Connect to YouTube"}</span>
      </Button>

      <p className="mt-4 text-xs text-muted-foreground">
        Connect your YouTube account to upload videos directly from this app.
      </p>
    </div>
  );
};

export default YouTubeConnect;
