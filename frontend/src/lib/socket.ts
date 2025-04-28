import axios from "axios";

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
