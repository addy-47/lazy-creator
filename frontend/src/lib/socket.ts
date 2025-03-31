import { io, Socket } from "socket.io-client";

// Create a single socket instance for the entire app
let socket: Socket | null = null;

// Initialize the socket connection
export const initSocket = (): Socket => {
  if (!socket) {
    socket = io("http://localhost:4000", {
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      console.log("Socket connected");
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  }

  return socket;
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
export const reconnectSocket = (): Socket => {
  disconnectSocket();
  return initSocket();
};

// Subscribe to generation progress
export const subscribeToProgress = (
  videoId: string,
  callback: (progress: number) => void
): void => {
  const currentSocket = socket || initSocket();
  currentSocket.emit("subscribe_progress", { videoId });
  currentSocket.on(`progress_${videoId}`, (data) => {
    callback(data.progress);
  });
};

// Unsubscribe from generation progress
export const unsubscribeFromProgress = (videoId: string): void => {
  if (socket) {
    socket.emit("unsubscribe_progress", { videoId });
    socket.off(`progress_${videoId}`);
  }
};
