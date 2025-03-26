import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/Button";
import { toast } from "sonner";
import { Youtube } from "lucide-react";

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
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: "",
    description: "",
    tags: "",
  });

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get("http://localhost:4000/api/gallery");

        if (response.data.status === "success") {
          setVideos(response.data.videos);
        } else {
          toast.error("Failed to fetch videos");
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
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await axios.get(
          "http://localhost:4000/api/youtube-auth-status",
          {
            headers: {
              "x-access-token": token,
            },
          }
        );

        if (response.data.status === "success") {
          setIsYouTubeConnected(response.data.authenticated);
        }
      } catch (error) {
        console.error("Error checking YouTube auth:", error);
      }
    };

    fetchVideos();
    checkYouTubeAuth();
  }, []);

  const handleDownload = async (videoId: string) => {
    try {
      const response = await axios.get(
        `http://localhost:4000/api/download/${videoId}`,
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
    try {
      const token = localStorage.getItem("token");

      // If token doesn't exist, redirect to auth page
      if (!token) {
        toast.error("Please log in to connect YouTube");
        window.location.href = "/auth";
        return;
      }

      const response = await axios.get(
        "http://localhost:4000/api/youtube-auth-start",
        {
          headers: {
            "x-access-token": token,
          },
        }
      );

      if (response.data.status === "success" && response.data.auth_url) {
        // Open the auth URL in a new window/tab
        window.location.href = response.data.auth_url;
      } else {
        toast.error("Failed to start YouTube authentication");
      }
    } catch (error) {
      console.error("Error connecting to YouTube:", error);
      toast.error("Failed to connect to YouTube");
    }
  };

  const handleUpload = async (videoId: string) => {
    try {
      setUploading(videoId);
      const token = localStorage.getItem("token");

      // If token doesn't exist, redirect to auth page
      if (!token) {
        toast.error("Please log in to upload to YouTube");
        window.location.href = "/auth";
        return;
      }

      // Prepare tags as array if provided
      const tags = uploadData.tags
        ? uploadData.tags.split(",").map((tag) => tag.trim())
        : [];

      const response = await axios.post(
        `http://localhost:4000/api/upload-to-youtube/${videoId}`,
        {
          title: uploadData.title,
          description: uploadData.description,
          tags: tags,
        },
        {
          headers: {
            "x-access-token": token,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "success") {
        toast.success("Video uploaded to YouTube successfully!");

        // Update the video in the list
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
      } else {
        toast.error(response.data.message || "Upload failed");
      }
    } catch (error: any) {
      console.error("Error uploading video:", error);

      // Check if this is an authentication error
      if (error.response?.data?.require_auth) {
        toast.error("YouTube authentication required");
        // Show the YouTube connect button
        setIsYouTubeConnected(false);
      } else {
        toast.error("Failed to upload video to YouTube");
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

  if (loading)
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-pulse">Loading videos...</div>
        </main>
        <Footer />
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-semibold md:text-4xl">
              Your Shorts Gallery
            </h1>

            {!isYouTubeConnected && (
              <Button
                onClick={connectYouTube}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Youtube size={18} />
                Connect YouTube
              </Button>
            )}
          </div>

          {videos.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-lg">
              <p className="text-foreground/70 mb-4">
                You haven't created any shorts yet.
              </p>
              <Button onClick={() => (window.location.href = "/create")}>
                Create Your First Short
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <div key={video.id} className="glass-card p-4 rounded-lg">
                  <div className="aspect-[9/16] bg-black rounded-md overflow-hidden mb-3">
                    <video
                      src={`http://localhost:4000/gallery/${video.filename}`}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium truncate">
                        {video.original_prompt}
                      </h3>
                      <p className="text-sm text-foreground/70">
                        Created: {new Date(video.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleDownload(video.id)}
                        className="flex-1"
                      >
                        Download
                      </Button>

                      {video.uploaded_to_yt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() =>
                            window.open(
                              `https://youtube.com/watch?v=${video.youtube_id}`,
                              "_blank"
                            )
                          }
                        >
                          View on YouTube
                        </Button>
                      ) : isYouTubeConnected ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            // Set default title and description based on the video
                            setUploadData({
                              title: `AI Short: ${video.original_prompt}`,
                              description: `AI-generated Short about ${video.original_prompt}`,
                              tags: "shorts,AI,technology",
                            });
                            document
                              .getElementById(`youtube-form-${video.id}`)
                              ?.classList.toggle("hidden");
                          }}
                        >
                          Upload to YouTube
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={connectYouTube}
                        >
                          Connect YouTube to Upload
                        </Button>
                      )}
                    </div>

                    <div
                      id={`youtube-form-${video.id}`}
                      className="hidden pt-3 space-y-2 border-t"
                    >
                      <input
                        type="text"
                        placeholder="Title"
                        value={uploadData.title}
                        onChange={(e) =>
                          setUploadData({
                            ...uploadData,
                            title: e.target.value,
                          })
                        }
                        className="w-full p-2 rounded-md bg-background border border-input text-sm"
                      />
                      <textarea
                        placeholder="Description"
                        value={uploadData.description}
                        onChange={(e) =>
                          setUploadData({
                            ...uploadData,
                            description: e.target.value,
                          })
                        }
                        className="w-full p-2 rounded-md bg-background border border-input text-sm"
                        rows={3}
                      />
                      <input
                        type="text"
                        placeholder="Tags (comma separated)"
                        value={uploadData.tags}
                        onChange={(e) =>
                          setUploadData({ ...uploadData, tags: e.target.value })
                        }
                        className="w-full p-2 rounded-md bg-background border border-input text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpload(video.id)}
                        disabled={uploading === video.id}
                        className="w-full"
                      >
                        {uploading === video.id
                          ? "Uploading..."
                          : "Upload to YouTube"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default GalleryPage;
