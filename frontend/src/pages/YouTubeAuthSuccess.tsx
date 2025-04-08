import React, { useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";

export default function YouTubeAuthSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setYouTubeConnected } = useContext(AuthContext);

  useEffect(() => {
    const checkYouTubeConnection = async () => {
      try {
        // Get state parameter from URL
        const urlParams = new URLSearchParams(location.search);
        const state = urlParams.get("state");

        if (!state) {
          toast.error("Authentication failed: Missing state parameter");
          navigate("/gallery");
          return;
        }

        // Wait a moment to ensure the backend has processed the auth
        setTimeout(async () => {
          const token = localStorage.getItem("token");
          if (!token) {
            toast.error("Authentication required");
            navigate("/auth");
            return;
          }

          // Check if we're connected to YouTube
          const response = await axios.get(
            `${getAPIBaseURL()}/api/youtube-auth-status`,
            {
              headers: {
                "x-access-token": token,
              },
            }
          );

          if (response.data.status === "success") {
            if (response.data.is_connected) {
              // Update global state
              setYouTubeConnected(true);

              toast.success("Successfully connected to YouTube!");

              // Redirect to gallery page
              navigate("/gallery");
            } else {
              toast.error("YouTube connection failed");
              navigate("/gallery");
            }
          }
        }, 1000);
      } catch (error) {
        console.error("Error checking YouTube connection:", error);
        toast.error("Error checking YouTube connection status");
        navigate("/gallery");
      }
    };

    checkYouTubeConnection();
  }, [navigate, location.search, setYouTubeConnected]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Connecting to YouTube...</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Please wait while we verify your YouTube connection
        </p>
        <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}
