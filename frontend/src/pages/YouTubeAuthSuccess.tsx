import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";
import { getToken, setToken } from "@/utils/tokenService";

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
        // Check if we received a new token from the auth callback
        const newTokenParam = urlParams.get("token");

        console.log("YouTube Auth Success - state:", state);
        console.log("YouTube Auth Success - code present:", !!code);
        console.log(
          "YouTube Auth Success - new token present:",
          !!newTokenParam
        );

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

        // If we received a new token directly from the server, update it
        if (newTokenParam) {
          console.log("Received new token from auth callback, updating...");
          setToken(newTokenParam);
        }

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
        const token = getToken();
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
              setToken(newToken);
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
              setToken(token);
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
                setError(
                  response.data?.message ||
                    "YouTube connection status check failed"
                );
                setProcessing(false);
                toast.error("YouTube connection status check failed");
                sendMessageAndFinish(false, "Connection status check failed");
              }
            } catch (verifyError) {
              console.error("Error verifying YouTube connection:", verifyError);
              setError("Error verifying YouTube connection");
              setProcessing(false);
              toast.error("Error verifying YouTube connection");
              sendMessageAndFinish(false, "Verification error");
            }
          }, 1500);
        }
      } catch (e: any) {
        console.error("Unexpected error in YouTube auth success:", e);
        setError("Unexpected error: " + e.message);
        setProcessing(false);
        toast.error("YouTube connection error: " + e.message);
      }
    };

    checkYouTubeConnection();
  }, [location.search, navigate, setYouTubeConnected]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="max-w-md w-full mx-auto bg-card p-6 rounded-lg shadow-lg border border-border">
        <h1 className="text-2xl font-bold mb-6 text-center">
          YouTube Connection
        </h1>

        {processing ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Processing YouTube authentication...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2 text-red-500">
              Connection Failed
            </h2>
            <p className="mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              This window will close in {countdownSeconds} seconds...
            </p>
            <button
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              onClick={() => window.close()}
            >
              Close Window
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold mb-2 text-green-500">
              Successfully Connected
            </h2>
            <p className="mb-4">
              Your YouTube account has been successfully connected!
            </p>
            <p className="text-sm text-muted-foreground">
              This window will close in {countdownSeconds} seconds...
            </p>
            <button
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              onClick={() => window.close()}
            >
              Close Window
            </button>
          </div>
        )}

        {debugInfo && (
          <div className="mt-8 text-xs text-muted-foreground border-t border-border pt-4">
            <details>
              <summary className="cursor-pointer font-mono">Debug Info</summary>
              <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
