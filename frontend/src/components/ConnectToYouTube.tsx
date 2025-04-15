import React, { useState, useEffect } from "react";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";
import { Button } from "@/components/Button";
import { Youtube, ChevronDown, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface YouTubeChannel {
  id: string;
  title: string;
  thumbnailUrl?: string;
  customUrl?: string;
}

interface ConnectToYouTubeProps {
  isYouTubeConnected: boolean;
  onConnectYouTube: () => void;
}

const ConnectToYouTube: React.FC<ConnectToYouTubeProps> = ({
  isYouTubeConnected,
  onConnectYouTube,
}) => {
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannel | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null); // For debugging

  // Fetch YouTube channels when connected
  useEffect(() => {
    if (isYouTubeConnected) {
      fetchUserChannels();
    }
  }, [isYouTubeConnected]);

  const fetchUserChannels = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        console.error("No auth token found");
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

      console.log("YouTube channels response:", response.data);

      if (response.data.status === "success" && response.data.channels) {
        setChannels(response.data.channels);

        // Set the first channel as the selected one if available
        if (response.data.channels.length > 0) {
          setSelectedChannel(response.data.channels[0]);
          // Store selected channel in localStorage for persistence
          localStorage.setItem(
            "selectedYouTubeChannel",
            JSON.stringify(response.data.channels[0])
          );
        }
      }
    } catch (error) {
      console.error("Error fetching YouTube channels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load selected channel from localStorage on component mount
  useEffect(() => {
    const savedChannel = localStorage.getItem("selectedYouTubeChannel");
    if (savedChannel) {
      try {
        setSelectedChannel(JSON.parse(savedChannel));
      } catch (e) {
        console.error("Error parsing saved channel:", e);
      }
    }

    // Check for debug info in URL params
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      setDebugInfo({
        error,
        message: params.get("message"),
      });
    }
  }, []);

  const handleChannelSelect = (channel: YouTubeChannel) => {
    setSelectedChannel(channel);
    localStorage.setItem("selectedYouTubeChannel", JSON.stringify(channel));
    setIsDropdownOpen(false);
  };

  // Debug function to fetch auth info directly
  const testAuthEndpoint = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(
        `${getAPIBaseURL()}/api/youtube-auth-start?debug=true`,
        {
          headers: { "x-access-token": token },
        }
      );

      setDebugInfo(response.data);
      console.log("Auth debug info:", response.data);
    } catch (error) {
      console.error("Auth endpoint test error:", error);
      setDebugInfo({ error: "Failed to test auth endpoint" });
    }
  };

  // Add debug check button to check for demo token
  const checkDemoToken = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setDebugInfo({ error: "No token found" });
      return;
    }

    // First check if it's literally the demo token
    if (token === "demo-token-for-testing") {
      setDebugInfo({
        isDemoToken: true,
        reason: "Using the demo-token-for-testing value",
        fix: "Log out and log in with a real account",
      });
      return;
    }

    // Next try to decode the JWT
    try {
      // For JWT token decoding
      const parts = token.split(".");
      if (parts.length !== 3) {
        setDebugInfo({
          error: "Token is not a valid JWT format",
          token: token.substring(0, 10) + "...",
        });
        return;
      }

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(window.atob(base64));

      const isDemoUser =
        payload.email === "demo@example.com" ||
        (typeof payload.email === "string" && payload.email.includes("demo"));

      setDebugInfo({
        payload,
        isDemoUser,
        token: token.substring(0, 10) + "...",
        fix: isDemoUser
          ? "Log out and log in with a real account"
          : "Your token looks valid",
      });
    } catch (e) {
      console.error("Error decoding token:", e);
      setDebugInfo({
        error: "Error decoding token",
        token: token.substring(0, 10) + "...",
        exception: String(e),
      });
    }
  };

  // Function to check token status on the server
  const checkTokenOnServer = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setDebugInfo({ error: "No token found" });
        return;
      }

      const response = await axios.get(`${getAPIBaseURL()}/api/debug/token`, {
        headers: {
          "x-access-token": token,
        },
      });

      console.log("Server token validation:", response.data);
      setDebugInfo({
        serverCheck: response.data,
        clientToken: token.substring(0, 10) + "...",
      });

      // Show toast about demo status if needed
      if (response.data.is_demo || response.data.is_demo_user) {
        toast.error(
          "You are using a demo account. YouTube features are limited."
        );
      }
    } catch (error) {
      console.error("Error checking token on server:", error);
      setDebugInfo({
        error: "Error checking token on server",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Function to fully reset demo status
  const fullReset = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("No token found to reset");
        return;
      }

      // First try server-side reset
      const response = await axios.post(
        `${getAPIBaseURL()}/api/debug/reset-demo`,
        {},
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      console.log("Reset response:", response.data);

      // Always clear client-side data
      localStorage.removeItem("token");
      localStorage.removeItem("youtubeConnected");
      localStorage.removeItem("selectedYouTubeChannel");
      localStorage.removeItem("checkYouTubeAuth");

      // Show success message
      toast.success("All auth data cleared! Reloading page...");

      // Reload the page after a brief delay
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1500);
    } catch (error) {
      console.error("Error during reset:", error);
      toast.error("Error during reset");

      // Still try to clear client data in case of error
      localStorage.removeItem("token");
      localStorage.removeItem("youtubeConnected");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-card border border-border rounded-xl p-5 shadow-sm">
      <h3 className="text-xl font-semibold mb-4">YouTube Connection</h3>

      {/* Debug button - only visible in development */}
      {process.env.NODE_ENV === "development" && (
        <div className="mb-4">
          <div className="flex gap-2 mb-2">
            <button
              onClick={testAuthEndpoint}
              className="text-xs text-primary underline"
            >
              Test Auth Endpoint
            </button>
            <button
              onClick={checkDemoToken}
              className="text-xs text-primary underline"
            >
              Check Token Type
            </button>
            <button
              onClick={checkTokenOnServer}
              className="text-xs text-primary underline"
            >
              Validate Token
            </button>
            <button
              onClick={fullReset}
              className="text-xs text-primary underline"
            >
              Full Reset
            </button>
          </div>
          {debugInfo && (
            <div className="text-xs mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-60">
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {!isYouTubeConnected ? (
        <div className="text-center py-3">
          <p className="text-sm text-muted-foreground mb-4">
            Connect your YouTube account to upload videos directly from the app
          </p>

          <Button
            onClick={onConnectYouTube}
            className="flex items-center gap-2 rounded-full bg-primary hover:bg-primary/90 text-white px-6"
          >
            <Youtube size={16} />
            <span>Connect to YouTube</span>
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle size={16} className="text-green-500" />
                YouTube Connected
              </span>
            </p>

            <Button
              onClick={onConnectYouTube}
              variant="outline"
              className="text-xs px-3 py-1 h-7 rounded-full"
            >
              Reconnect
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : channels.length > 0 ? (
            <div className="mt-4">
              <label className="text-sm font-medium block mb-2">
                Select Channel for Uploads
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-3 rounded-lg bg-background border border-input flex items-center justify-between focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                >
                  {selectedChannel ? (
                    <div className="flex items-center gap-2">
                      {selectedChannel.thumbnailUrl && (
                        <img
                          src={selectedChannel.thumbnailUrl}
                          alt={selectedChannel.title}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      )}
                      <span>{selectedChannel.title}</span>
                    </div>
                  ) : (
                    <span>Select a channel</span>
                  )}
                  <ChevronDown size={16} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md bg-background border border-border shadow-lg">
                    <ul className="py-1 max-h-60 overflow-auto">
                      {channels.map((channel) => (
                        <li key={channel.id}>
                          <button
                            type="button"
                            onClick={() => handleChannelSelect(channel)}
                            className={`w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-primary/10 ${
                              selectedChannel?.id === channel.id
                                ? "bg-primary/5"
                                : ""
                            }`}
                          >
                            {channel.thumbnailUrl && (
                              <img
                                src={channel.thumbnailUrl}
                                alt={channel.title}
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            )}
                            <span>{channel.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {selectedChannel?.customUrl && (
                <a
                  href={`https://youtube.com/channel/${selectedChannel.customUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 mt-2 hover:underline"
                >
                  <span>View Channel</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No YouTube channels found for your account
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectToYouTube;
