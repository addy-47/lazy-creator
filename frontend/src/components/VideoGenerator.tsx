import React, { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { Button, Progress, message } from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";

interface VideoGeneratorProps {
  videoId: string;
  onVideoGenerated: (videoUrl: string) => void;
}

const VideoGenerator: React.FC<VideoGeneratorProps> = ({
  videoId,
  onVideoGenerated,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(
      process.env.REACT_APP_API_URL || "http://localhost:5000",
      {
        transports: ["websocket"],
      }
    );

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket server");
      // Join room for this specific video
      newSocket.emit("join", { room: videoId });
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    newSocket.on(
      "generation_progress",
      (data: { progress: number; message: string }) => {
        setProgress(data.progress);
        setStatus(data.message);
      }
    );

    newSocket.on("generation_complete", (data: { videoUrl: string }) => {
      setIsGenerating(false);
      setProgress(100);
      setStatus("Video generation completed!");
      onVideoGenerated(data.videoUrl);
      message.success("Video generated successfully!");
    });

    newSocket.on("generation_error", (data: { error: string }) => {
      setIsGenerating(false);
      setProgress(0);
      setStatus("Error generating video");
      message.error(data.error || "Failed to generate video");
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.emit("leave", { room: videoId });
        newSocket.disconnect();
      }
    };
  }, [videoId, onVideoGenerated]);

  const handleGenerateVideo = async () => {
    try {
      setIsGenerating(true);
      setProgress(0);
      setStatus("Starting video generation...");

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/generate-short`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start video generation");
      }
    } catch (error) {
      setIsGenerating(false);
      setProgress(0);
      setStatus("Error starting video generation");
      message.error("Failed to start video generation");
    }
  };

  return (
    <div className="video-generator">
      <Button
        type="primary"
        icon={<VideoCameraOutlined />}
        onClick={handleGenerateVideo}
        loading={isGenerating}
        disabled={isGenerating}
      >
        Generate Video
      </Button>
      {isGenerating && (
        <div className="generation-progress">
          <Progress
            percent={progress}
            status={progress === 100 ? "success" : "active"}
          />
          <p>{status}</p>
        </div>
      )}
    </div>
  );
};

export default VideoGenerator;
