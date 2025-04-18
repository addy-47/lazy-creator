import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";

export default function YouTubeAuthSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setYouTubeConnected } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(5);

  useEffect(() => {
    // Add debug info
    setDebugInfo({
      currentUrl: window.location.href,
      pathname: location.pathname,
      search: location.search,
      origin: window.location.origin,
      apiBaseUrl: getAPIBaseURL(),
      hasOpener: !!window.opener,
    });

    const checkYouTubeConnection = async () => {
      try {
        // Get state parameter from URL
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        const errorParam = urlParams.get("error");

        console.log("YouTube Auth Success - state:", state);
        console.log("YouTube Auth Success - code present:", !!code);

        // Function to send message to opener window and close this tab
        const sendMessageAndFinish = (
          success: boolean,
          message?: string,
          token?: string
        ) => {
          try {
            if (window.opener && !window.opener.closed) {
              // Send a message to the opener window
              window.opener.postMessage(
                {
                  type: "youtube_auth_success",
                  success,
                  error: message,
                  token,
                },
                window.location.origin
              );

              console.log("Sent message to opener:", {
                type: "youtube_auth_success",
                success,
                error: message,
              });

              // Start countdown to auto-close
              let seconds = 5;
              const countdownInterval = setInterval(() => {
                seconds -= 1;
                setCountdownSeconds(seconds);

                if (seconds <= 0) {
                  clearInterval(countdownInterval);
                  // Auto close after countdown
                  window.close();
                }
              }, 1000);
            } else {
              console.warn("No opener window found or it was closed");
              // If we can't message back, navigate to gallery with status
              const statusParam = success
                ? "youtube_auth=success"
                : `error=auth_failed&message=${encodeURIComponent(
                    message || "Unknown error"
                  )}`;
              if (token) {
                navigate(
                  `/gallery?${statusParam}&token=${encodeURIComponent(token)}`
                );
              } else {
                navigate(`/gallery?${statusParam}`);
              }
            }
          } catch (err) {
            console.error("Error sending message to opener:", err);
            // Fallback to navigation
            navigate(
              `/gallery${
                success
                  ? "?youtube_auth=success"
                  : `?error=auth_failed&message=${encodeURIComponent(
                      message || "Communication error"
                    )}`
              }`
            );
          }
        };

        if (errorParam) {
          const errorMessage =
            urlParams.get("message") || "Authentication failed";
          setError(errorMessage);
          setProcessing(false);
          toast.error(`YouTube connection error: ${errorMessage}`);
          sendMessageAndFinish(false, errorMessage);
          return;
        }

        if (!code) {
          setError("Missing authorization code");
          setProcessing(false);
          toast.error("Authentication failed: Missing authorization code");
          sendMessageAndFinish(false, "Missing authorization code");
          return;
        }

        if (!state) {
          setError("Missing state parameter");
          setProcessing(false);
          toast.error("Authentication failed: Missing state parameter");
          sendMessageAndFinish(false, "Missing state parameter");
          return;
        }

        // Get token
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Authentication required");
          setProcessing(false);
          toast.error("Authentication required");
          sendMessageAndFinish(false, "Authentication required");
          return;
        }

        // Validate state parameter against our stored state
        const storedState = localStorage.getItem("youtube_auth_state");

        if (storedState && storedState !== state) {
          setError("Invalid state parameter - potential security issue");
          setProcessing(false);
          toast.error("Authentication failed: State validation failed");
          sendMessageAndFinish(false, "State validation failed");
          localStorage.removeItem("youtube_auth_state");
          return;
        }

        // Clear stored state
        localStorage.removeItem("youtube_auth_state");

        // Redirect the authorization code to our backend
        try {
          // Manually construct callback URL with required params
          const callbackUrl = `${getAPIBaseURL()}/api/youtube/auth/callback?code=${encodeURIComponent(
            code
          )}&state=${encodeURIComponent(
            state
          )}&redirect_uri=${encodeURIComponent(
            window.location.origin + "/youtube-auth-success"
          )}`;

          console.log("Redirecting code to backend at:", callbackUrl);

          const response = await axios.get(callbackUrl);

          console.log("Backend callback response:", response.data);

          if (response.data && response.data.status === "success") {
            // Update global state
            setYouTubeConnected(true);
            setProcessing(false);
            toast.success("Successfully connected to YouTube!");

            // Send success message and close window
            const newToken = response.data.token || null;
            if (newToken) {
              localStorage.setItem("token", newToken);
            }

            sendMessageAndFinish(true, undefined, newToken);
          } else {
            const errorMsg =
              response.data?.message ||
              "YouTube connection verification failed";
            setError(errorMsg);
            setProcessing(false);
            toast.error("YouTube connection failed: " + errorMsg);
            sendMessageAndFinish(false, errorMsg);
          }
        } catch (error: any) {
          console.error("Error sending code to backend:", error);

          // Check if we got a redirect response (older server versions)
          if (
            error.request &&
            error.request.responseURL &&
            error.request.responseURL.includes("youtube_auth=success")
          ) {
            // This was actually a success, but received a redirect instead of JSON
            setYouTubeConnected(true);
            setProcessing(false);
            toast.success("Successfully connected to YouTube!");

            // Try to extract token from redirect URL
            const url = new URL(error.request.responseURL);
            const token = url.searchParams.get("token");
            if (token) {
              localStorage.setItem("token", token);
            }

            sendMessageAndFinish(true, undefined, token || undefined);
            return;
          }

          // Wait a moment then check auth status anyway
          setTimeout(async () => {
            try {
              // Check if we're connected to YouTube
              console.log("Checking YouTube connection status...");
              const response = await axios.get(
                `${getAPIBaseURL()}/api/youtube-auth-status`,
                {
                  headers: {
                    "x-access-token": token,
                  },
                }
              );

              console.log("YouTube auth status response:", response.data);

              if (response.data.status === "success") {
                if (response.data.is_connected || response.data.authenticated) {
                  // Update global state
                  setYouTubeConnected(true);
                  setProcessing(false);
                  toast.success("Successfully connected to YouTube!");
                  sendMessageAndFinish(true);
                } else {
                  setError("YouTube connection verification failed");
                  setProcessing(false);
                  toast.error("YouTube connection failed");
                  sendMessageAndFinish(false, "Connection verification failed");
                }
              } else {
                setError("Invalid response from server");
                setProcessing(false);
                toast.error("Error verifying YouTube connection");
                sendMessageAndFinish(false, "Invalid response from server");
              }
            } catch (statusError: any) {
              console.error("Error checking YouTube connection:", statusError);
              setError(
                statusError?.response?.data?.message ||
                  "Connection verification failed"
              );
              setProcessing(false);
              toast.error("Error checking YouTube connection status");
              sendMessageAndFinish(false, "Error checking connection status");
            }
          }, 1500);
        }
      } catch (error: any) {
        console.error("Error in YouTube auth success page:", error);
        setError(error?.message || "An unknown error occurred");
        setProcessing(false);
        toast.error("Error processing YouTube authentication");

        if (window.opener) {
          window.opener.postMessage(
            {
              type: "youtube_auth_success",
              success: false,
              error: error?.message || "An unknown error occurred",
            },
            window.location.origin
          );

          // Start auto-close countdown
          let seconds = 5;
          const countdownInterval = setInterval(() => {
            seconds -= 1;
            setCountdownSeconds(seconds);

            if (seconds <= 0) {
              clearInterval(countdownInterval);
              window.close();
            }
          }, 1000);
        } else {
          navigate(
            `/gallery?error=auth_failed&message=${encodeURIComponent(
              error?.message || "An unknown error occurred"
            )}`
          );
        }
      }
    };

    checkYouTubeConnection();
  }, [navigate, location.search, setYouTubeConnected]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md bg-card rounded-xl shadow-sm border border-border">
        <h1 className="text-3xl font-bold mb-4">
          {error ? "Authentication Failed" : "Connecting to YouTube..."}
        </h1>

        {processing ? (
          <>
            <p className="text-lg text-muted-foreground mb-6">
              Please wait while we verify your YouTube connection
            </p>
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
          </>
        ) : error ? (
          <>
            <p className="text-red-500 mb-6">{error}</p>
            <p className="text-sm text-muted-foreground mb-4">
              This window will close automatically in {countdownSeconds} seconds
            </p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
            >
              Close This Window
            </button>
          </>
        ) : (
          <>
            <p className="text-green-500 mb-6">Connection successful!</p>
            <p className="text-sm text-muted-foreground mb-4">
              This window will close automatically in {countdownSeconds} seconds
            </p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
            >
              Close This Window
            </button>
          </>
        )}

        {/* Debug information - only in development */}
        {process.env.NODE_ENV === "development" && debugInfo && (
          <div className="mt-8 text-left text-xs p-4 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-60">
            <h3 className="font-bold mb-2">Debug Information:</h3>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
