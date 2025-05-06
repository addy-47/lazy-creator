import axios from "axios";
import {
  shouldRefreshToken,
  refreshToken,
  getToken,
  SESSION_EXPIRED_EVENT,
} from "@/utils/tokenService";

export const getAPIBaseURL = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;
  return (
    apiUrl ||
    (window.location.hostname === "localhost"
      ? "http://localhost:4000"
      : "https://backend-xyz.run.app/api")
  );
};

export const getWebSocketURL = (): string => {
  const wsUrl = import.meta.env.VITE_WEBSOCKET_URL;
  if (wsUrl) return wsUrl;
  const apiBase = getAPIBaseURL().replace(/^http/, "ws");
  return apiBase.replace(/\/api$/, "/ws");
};

// Add WebSocket client (example integration)
export const connectWebSocket = () => {
  const ws = new WebSocket(getWebSocketURL());
  ws.onmessage = (event) => console.log("WS Message:", event.data);
  ws.onerror = (error) => console.error("WS Error:", error);
  return ws;
};

// Rest of your axios configuration...
export const api = axios.create({
  baseURL: getAPIBaseURL(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: false,
});

// ... (rest of apiWithoutPreflight, interceptors, setAuthToken)

// Fix CORS issues by directly calling api without preflight when possible
export const apiWithoutPreflight = {
  get: async (url: string, config?: any) => {
    // For GET requests, we can attach the token directly to the URL to avoid preflight
    const token = getToken();
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
    const token = getToken();
    const separator = url.includes("?") ? "&" : "?";
    const tokenParam = token
      ? `${separator}token=${encodeURIComponent(token)}`
      : "";
    const fullUrl = `${url}${tokenParam}`;

    return api.delete(fullUrl, config);
  },
};

// Variable to track if a token refresh is in progress
let isRefreshing = false;
// Store pending requests that should be retried after token refresh
let pendingRequests: any[] = [];
// Track if session expired notification was already shown
let sessionExpiredNotificationShown = false;

// Function to process pending requests after token refresh
const processPendingRequests = (token: string | null) => {
  pendingRequests.forEach(({ config, resolve, reject }) => {
    if (token) {
      // Update the token in the request
      config.headers["x-access-token"] = token;
      config.headers["Authorization"] = `Bearer ${token}`;
      // Retry the request
      axios(config).then(resolve).catch(reject);
    } else {
      // If token refresh failed, reject all pending requests
      reject(new Error("Token refresh failed"));
    }
  });

  // Clear pending requests
  pendingRequests = [];
};

// Add request interceptor to handle auth properly
api.interceptors.request.use(
  async (config) => {
    // Check if token needs refresh before sending the request
    if (
      shouldRefreshToken() &&
      !isRefreshing &&
      config.url !== "/refresh-token"
    ) {
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const newToken = await refreshToken();
        isRefreshing = false;

        // Update the request with the new token
        if (newToken) {
          config.headers["x-access-token"] = newToken;
          config.headers["Authorization"] = `Bearer ${newToken}`;
        }
      } catch (error) {
        console.error("Error refreshing token in interceptor:", error);
        isRefreshing = false;
      }
    } else {
      // Get token from localStorage for each request
      const token = getToken();

      // Add token to headers if it exists
      if (token) {
        config.headers["x-access-token"] = token;
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the error is due to an expired token (401) and we haven't tried to refresh yet
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/refresh-token"
    ) {
      originalRequest._retry = true;

      // If a refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({ config: originalRequest, resolve, reject });
        });
      }

      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const newToken = await refreshToken();
        isRefreshing = false;

        if (newToken) {
          // Process any pending requests with the new token
          processPendingRequests(newToken);

          // Update the original request with the new token
          originalRequest.headers["x-access-token"] = newToken;
          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;

          // Retry the original request
          return axios(originalRequest);
        } else {
          // If token refresh failed, handle authentication failure
          isRefreshing = false;
          processPendingRequests(null);

          // Only show the expired session notification once
          if (!sessionExpiredNotificationShown) {
            sessionExpiredNotificationShown = true;
            // Dispatch the session expired event
            window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
          }

          return Promise.reject(error);
        }
      } catch (refreshError) {
        isRefreshing = false;
        processPendingRequests(null);
        console.error("Error during token refresh:", refreshError);

        // Only show the expired session notification once
        if (!sessionExpiredNotificationShown) {
          sessionExpiredNotificationShown = true;
          // Dispatch the session expired event
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
        }

        return Promise.reject(refreshError);
      }
    }

    // For any other error, forward it
    return Promise.reject(error);
  }
);

// Reset session expired notification flag when user logs in
export const resetSessionExpiredFlag = () => {
  sessionExpiredNotificationShown = false;
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common["x-access-token"] = token;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["x-access-token"];
    delete api.defaults.headers.common["Authorization"];
  }
};
