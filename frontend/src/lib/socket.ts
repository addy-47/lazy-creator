import { io, Socket } from "socket.io-client";
import axios from "axios";

// Create a single socket instance for the entire app
let socket: Socket | null = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 2;
let useSocketFallback = false;

// Helper to get API base URL consistently for both HTTP and WebSocket
export const getAPIBaseURL = (): string => {
  // Using the actual hostname dynamically to support both localhost and IP addresses
  const hostname =
    window.location.hostname === "localhost"
      ? "localhost"
      : window.location.hostname;

  // Get the base URL without the /api path for socket.io connection
  return `http://${hostname}:4000`;
};

// Create preconfigured axios instance for consistent API calls
export const api = axios.create({
  baseURL: getAPIBaseURL(),
  timeout: 15000, // 15 seconds timeout
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest", // Add this to help with CORS
  },
  withCredentials: false, // Don't send credentials by default
});

// Fix CORS issues by directly calling api without preflight when possible
export const apiWithoutPreflight = {
  get: async (url: string, config?: any) => {
    // For GET requests, we can attach the token directly to the URL to avoid preflight
    const token = localStorage.getItem("token");
    const separator = url.includes("?") ? "&" : "?";
    const tokenParam = token
      ? `${separator}token=${encodeURIComponent(token)}`
      : "";
    const fullUrl = `${url}${tokenParam}`;

    return api.get(fullUrl, config);
  },
  post: async (url: string, data?: any, config?: any) => {
    return api.post(url, data, config);
  },
  delete: async (url: string, config?: any) => {
    // For DELETE requests, similar to GET
    const token = localStorage.getItem("token");
    const separator = url.includes("?") ? "&" : "?";
    const tokenParam = token
      ? `${separator}token=${encodeURIComponent(token)}`
      : "";
    const fullUrl = `${url}${tokenParam}`;

    return api.delete(fullUrl, config);
  },
};

// Add interceptors to handle auth properly
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage for each request
    const token = localStorage.getItem("token");

    // Add token to headers if it exists
    if (token) {
      config.headers["x-access-token"] = token;
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function to set auth token
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common["x-access-token"] = token;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["x-access-token"];
    delete api.defaults.headers.common["Authorization"];
  }

  // Store in localStorage for persistence
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
};

// Helper to check if socket.io server exists before attempting connection
const checkSocketServerAvailability = async (): Promise<boolean> => {
  // Check if we're in development mode and use fallback by default for faster loading
  if (process.env.NODE_ENV === "development") {
    console.log(
      "Development mode detected, skipping socket connection and using fallback"
    );
    return false;
  }

  try {
    // Use dynamic hostname for Windows networking compatibility
    const apiUrl = `${getAPIBaseURL()}/api/health`;
    console.log(`Checking socket server availability at: ${apiUrl}`);

    try {
      // Create controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // Reduce timeout to 2 seconds

      const response = await fetch(apiUrl, {
        method: "HEAD",
        mode: "cors", // Change to cors mode to handle CORS properly
        cache: "no-cache",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      // If we get a response, server is available
      if (response.ok) {
        console.log("Socket.io server is available");
        return true;
      } else {
        console.warn(
          `Socket.io server check failed with status: ${response.status}`
        );
        return false;
      }
    } catch (fetchError) {
      console.warn("Socket connection check failed:", fetchError);
      return false;
    }
  } catch (error) {
    console.warn(
      "Socket.io server may not be available, using fallback",
      error
    );
    return false;
  }
};

// Initialize the socket connection
export const initSocket = async (): Promise<Socket | null> => {
  if (socket) return socket;

  // If we've already determined we should use fallback, just return null
  if (useSocketFallback) {
    console.log("Socket fallback mode active, using offline mode");
    return null;
  }

  // If max reconnection attempts exceeded, use fallback
  if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn("Max socket connection attempts reached, using fallback mode");
    useSocketFallback = true;
    return null;
  }

  try {
    // Increment connection attempts
    connectionAttempts++;

    // Immediately use fallback mode if we're in a problematic environment
    if (typeof window !== "undefined" && window.location.protocol === "file:") {
      console.warn("Local file protocol detected, using fallback mode");
      useSocketFallback = true;
      return null;
    }

    // Check if socket server is available using a promise with timeout
    let isAvailable = false;
    try {
      const availabilityPromise = checkSocketServerAvailability();
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 2000);
      });

      isAvailable = await Promise.race([availabilityPromise, timeoutPromise]);
    } catch (error) {
      console.warn("Error checking socket availability:", error);
      isAvailable = false;
    }

    if (!isAvailable) {
      console.warn("Socket server unavailable, using fallback mode");
      useSocketFallback = true;
      return null;
    }

    // Use the dynamic hostname for better Windows compatibility
    const socketURL = getAPIBaseURL();

    // Create socket with improved error handling
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
