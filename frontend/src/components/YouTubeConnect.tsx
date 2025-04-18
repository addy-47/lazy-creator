import React, { useState, useEffect } from "react";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";
import { toast } from "sonner";
import { Youtube, Loader2 } from "lucide-react";
import { Button } from "@/components/Button";

interface YouTubeConnectProps {
  onConnectionChange?: (connected: boolean) => void;
}

const YouTubeConnect: React.FC<YouTubeConnectProps> = ({
  onConnectionChange,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

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
  const checkConnectionStatus = async () => {
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

        if (connected && onConnectionChange) {
          onConnectionChange(true);
          // Also fetch channels if connected
          fetchChannels();
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
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube/channels`,
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      if (response.data.status === "success" && response.data.channels) {
        setChannels(response.data.channels);
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
    }
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
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4 text-green-500">
          <Youtube size={20} />
          <span className="font-medium">
            Your YouTube account is connected!
          </span>
        </div>

        {channels.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">
              Your YouTube Channels:
            </h3>
            <ul className="space-y-2">
              {channels.map((channel) => (
                <li
                  key={channel.id}
                  className="flex items-center gap-2 p-2 bg-background/30 rounded-md"
                >
                  {channel.thumbnailUrl && (
                    <img
                      src={channel.thumbnailUrl}
                      alt={channel.title}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium">{channel.title}</p>
                    {channel.customUrl && (
                      <p className="text-xs text-muted-foreground">
                        @{channel.customUrl}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      {errorMessage && (
        <p className="text-red-500 mb-4 text-sm">{errorMessage}</p>
      )}

      <Button
        onClick={connectToYouTube}
        disabled={isConnecting}
        variant="purple"
        className="w-full"
      >
        {isConnecting ? (
          <div className="flex items-center justify-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <span>Connecting...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Youtube size={16} className="mr-2" />
            <span>Connect to YouTube</span>
          </div>
        )}
      </Button>

      <p className="mt-4 text-xs text-muted-foreground">
        Connect your YouTube account to upload videos directly from this app.
      </p>
    </div>
  );
};

export default YouTubeConnect;
