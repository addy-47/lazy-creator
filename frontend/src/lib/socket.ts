import axios from "axios";

// Helper to get API base URL consistently for both HTTP and WebSocket
export const getAPIBaseURL = (): string => {
  // Use the environment variable if available
  const apiUrl = import.meta.env.VITE_API_URL;
  
  if (apiUrl) {
    return apiUrl;
  }
  
  // Fallback for local development
  if (window.location.hostname === "localhost") {
    return "http://localhost:4000";
  }
  
  // Production fallback
  return "https://backend.lazycreator.in";
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
