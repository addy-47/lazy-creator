import React, { useEffect, useContext, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";

export default function YouTubeAuthSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setYouTubeConnected } = useContext(AuthContext);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    // Add debug info
    setDebugInfo({
      currentUrl: window.location.href,
      pathname: location.pathname,
      search: location.search,
      origin: window.location.origin,
      apiBaseUrl: getAPIBaseURL(),
    });

    const checkYouTubeConnection = async () => {
      try {
        // Get state parameter from URL
        const urlParams = new URLSearchParams(location.search);
        const state = urlParams.get("state");
        const errorParam = urlParams.get("error");

        console.log("YouTube Auth Success - state:", state);
        console.log("YouTube Auth Success - location:", location);

        if (errorParam) {
          const errorMessage =
            urlParams.get("message") || "Authentication failed";
          setError(errorMessage);
          setProcessing(false);
          toast.error(`YouTube connection error: ${errorMessage}`);
          return;
        }

        if (!state) {
          setError("Missing state parameter");
          setProcessing(false);
          toast.error("Authentication failed: Missing state parameter");
          return;
        }

        // Get token
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Authentication required");
          setProcessing(false);
          toast.error("Authentication required");
          navigate("/auth");
          return;
        }

        // Wait a moment to ensure the backend has processed the auth
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

                // Redirect to gallery page
                navigate("/gallery");
              } else {
                setError("YouTube connection verification failed");
                setProcessing(false);
                toast.error("YouTube connection failed");
                navigate("/gallery");
              }
            } else {
              setError("Invalid response from server");
              setProcessing(false);
              toast.error("Error verifying YouTube connection");
              navigate("/gallery");
            }
          } catch (error: any) {
            console.error("Error checking YouTube connection:", error);
            setError(
              error?.response?.data?.message || "Connection verification failed"
            );
            setProcessing(false);
            toast.error("Error checking YouTube connection status");
            navigate("/gallery");
          }
        }, 1500);
      } catch (error: any) {
        console.error("Error in YouTube auth success page:", error);
        setError(error?.message || "An unknown error occurred");
        setProcessing(false);
        toast.error("Error processing YouTube authentication");
        navigate("/gallery");
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
            <button
              onClick={() => navigate("/gallery")}
              className="px-6 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
            >
              Return to Gallery
            </button>
          </>
        ) : (
          <>
            <p className="text-green-500 mb-6">Connection successful!</p>
            <p>Redirecting to gallery...</p>
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
