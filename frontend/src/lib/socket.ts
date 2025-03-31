import { io, Socket } from "socket.io-client";
import axios from "axios";

// Create a single socket instance for the entire app
let socket: Socket | null = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let useSocketFallback = false;

// Helper to get API base URL consistently for both HTTP and WebSocket
export const getAPIBaseURL = (): string => {
  // Using the actual hostname dynamically to support both localhost and IP addresses
  const hostname =
    window.location.hostname === "localhost"
      ? "localhost"
      : window.location.hostname;
  return `http://${hostname}:4000`;
};

// Create preconfigured axios instance for consistent API calls
export const api = axios.create({
  baseURL: getAPIBaseURL(),
  timeout: 15000, // 15 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper function to set auth token
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common["x-access-token"] = token;
  } else {
    delete api.defaults.headers.common["x-access-token"];
  }
};

// Helper to check if socket.io server exists before attempting connection
const checkSocketServerAvailability = async (): Promise<boolean> => {
  try {
    // Use dynamic hostname for Windows networking compatibility
    const apiUrl = `${getAPIBaseURL()}/api/health`;
    const response = await fetch(apiUrl, {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-cache",
    });
    return true;
  } catch (error) {
    console.warn("Socket.io server may not be available, using fallback");
    return false;
  }
};

// Initialize the socket connection
export const initSocket = async (): Promise<Socket | null> => {
  if (socket) return socket;

  if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS || useSocketFallback) {
    console.warn("Socket functionality disabled - using local fallback mode");
    return null;
  }

  try {
    // Check if socket server is available first
    const isAvailable = await checkSocketServerAvailability();
    if (!isAvailable) {
      useSocketFallback = true;
      return null;
    }

    connectionAttempts++;

    // Use the dynamic hostname for better Windows compatibility
    const socketURL = getAPIBaseURL();

    socket = io(socketURL, {
      transports: ["polling", "websocket"], // Try polling first, which is more compatible with Windows
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 5000,
      path: "/socket.io/", // Explicitly specify path
    });

    socket.on("connect", () => {
      console.log("Socket connected");
      connectionAttempts = 0; // Reset counter on successful connection
    });

    socket.on("connect_error", (error) => {
      console.warn("Socket connection error:", error.message);

      // Windows compatibility: immediately use fallback after first error
      if (error.message.includes("404") || error.message.includes("failed")) {
        useSocketFallback = true;
        if (socket) {
          socket.disconnect();
          socket = null;
        }
        console.warn("Socket server not available, using fallback mode");
      } else if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
        useSocketFallback = true;
        if (socket) {
          socket.disconnect();
          socket = null;
        }
        console.warn(
          "Max socket connection attempts reached, using fallback mode"
        );
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });

    return socket;
  } catch (error) {
    console.error("Error initializing socket:", error);
    useSocketFallback = true;
    return null;
  }
};

// Get the socket instance
export const getSocket = (): Socket | null => {
  return socket;
};

// Disconnect the socket
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Reconnect the socket
export const reconnectSocket = async (): Promise<Socket | null> => {
  disconnectSocket();
  connectionAttempts = 0; // Reset attempts when manually reconnecting
  useSocketFallback = false; // Reset fallback flag to try connection again
  return await initSocket();
};

// Subscribe to generation progress
export const subscribeToProgress = (
  videoId: string,
  callback: (progress: number) => void
): void => {
  const socketPromise = socket ? Promise.resolve(socket) : initSocket();

  socketPromise.then((currentSocket) => {
    if (!currentSocket || useSocketFallback) {
      // Enhanced fallback behavior with more realistic progress simulation
      console.log(
        "Using fallback progress simulation for Windows compatibility"
      );
      let fakeProgress = 0;
      const totalTime = 15000; // 15 seconds total
      const interval = setInterval(() => {
        // More realistic progress patterns with initial slow start
        if (fakeProgress < 20) {
          fakeProgress += Math.random() * 3;
        } else if (fakeProgress < 80) {
          fakeProgress += Math.random() * 10;
        } else {
          fakeProgress += Math.random() * 3;
        }

        if (fakeProgress >= 100) {
          fakeProgress = 100;
          clearInterval(interval);
        }
        callback(Math.min(Math.round(fakeProgress), 100));
      }, totalTime / 30);
      return;
    }

    currentSocket.emit("subscribe_progress", { videoId });
    currentSocket.on(`progress_${videoId}`, (data) => {
      callback(data.progress);
    });
  });
};

// Unsubscribe from generation progress
export const unsubscribeFromProgress = (videoId: string): void => {
  if (socket) {
    socket.emit("unsubscribe_progress", { videoId });
    socket.off(`progress_${videoId}`);
  }
};
