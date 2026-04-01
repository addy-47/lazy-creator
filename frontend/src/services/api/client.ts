import axios from "axios";
import {
  shouldRefreshToken,
  refreshToken,
  getToken,
  clearToken,
  emitSessionExpiredEvent,
  SESSION_EXPIRED_EVENT,
} from "../tokenService";
import { getLzySvcBaseURL, getLzyDirectorBaseURL } from "../config";

// Centralized API client configuration
const createApiClient = (baseURL: string) => {
  return axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    withCredentials: false,
  });
};

// Create centralized API clients
const lzySvcApi = createApiClient(getLzySvcBaseURL());
const lzyDirectorApi = createApiClient(getLzyDirectorBaseURL());

// Interceptor State for token refresh
let isRefreshing = false;
let pendingRequests: any[] = [];
let sessionExpiredNotificationShown = false;

/**
 * Processes the queue of pending requests after a successful token refresh.
 */
const processPendingRequests = (token: string | null) => {
  pendingRequests.forEach(({ config, resolve, reject }) => {
    if (token) {
      config.headers["x-access-token"] = token;
      config.headers["Authorization"] = `Bearer ${token}`;
      axios(config).then(resolve).catch(reject);
    } else {
      reject(new Error("Token refresh failed"));
    }
  });

  pendingRequests = [];
};

// Request interceptor to add token and handle refresh
lzySvcApi.interceptors.request.use(
  async (config) => {
    if (
      shouldRefreshToken() &&
      !isRefreshing &&
      config.url !== "/refresh-token"
    ) {
      isRefreshing = true;

      try {
        const newToken = await refreshToken();
        isRefreshing = false;

        if (newToken) {
          config.headers["x-access-token"] = newToken;
          config.headers["Authorization"] = `Bearer ${newToken}`;
        }
      } catch (error) {
        console.error("Error refreshing token in interceptor:", error);
        isRefreshing = false;
      }
    } else {
      const token = getToken();
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

lzyDirectorApi.interceptors.request.use(
  async (config) => {
    if (
      shouldRefreshToken() &&
      !isRefreshing &&
      config.url !== "/refresh-token"
    ) {
      isRefreshing = true;

      try {
        const newToken = await refreshToken();
        isRefreshing = false;

        if (newToken) {
          config.headers["x-access-token"] = newToken;
          config.headers["Authorization"] = `Bearer ${newToken}`;
        }
      } catch (error) {
        console.error("Error refreshing token in interceptor:", error);
        isRefreshing = false;
      }
    } else {
      const token = getToken();
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

// Response interceptor to handle 401 errors and token refresh
const responseInterceptor = (response: any) => response;
const errorInterceptor = async (error: any) => {
  const originalRequest = error.config;

  if (
    error.response &&
    error.response.status === 401 &&
    !originalRequest._retry &&
    originalRequest.url !== "/refresh-token"
  ) {
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({ config: originalRequest, resolve, reject });
      });
    }

    isRefreshing = true;

    try {
      const newToken = await refreshToken();
      isRefreshing = false;

      if (newToken) {
        processPendingRequests(newToken);
        originalRequest.headers["x-access-token"] = newToken;
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return axios(originalRequest);
      } else {
        isRefreshing = false;
        processPendingRequests(null);

        if (!sessionExpiredNotificationShown) {
          sessionExpiredNotificationShown = true;
          clearToken();
          emitSessionExpiredEvent();
        }

        return Promise.reject(error);
      }
    } catch (refreshError) {
      isRefreshing = false;
      processPendingRequests(null);
      console.error("Error during token refresh:", refreshError);

      if (!sessionExpiredNotificationShown) {
        sessionExpiredNotificationShown = true;
        clearToken();
        emitSessionExpiredEvent();
      }

      return Promise.reject(refreshError);
    }
  }

  return Promise.reject(error);
};

lzySvcApi.interceptors.response.use(responseInterceptor, errorInterceptor);
lzyDirectorApi.interceptors.response.use(responseInterceptor, errorInterceptor);

/**
 * Resets the session expiration notification flag.
 */
export const resetSessionExpiredFlag = () => {
  sessionExpiredNotificationShown = false;
};

/**
 * Standardized error handler for API responses
 */
const handleApiError = (error: any): never => {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = error.response.data?.message || error.message;

    switch (status) {
      case 401:
        throw new Error("Session expired. Please log in again.");
      case 403:
        throw new Error("Access denied. You don't have permission for this action.");
      case 404:
        throw new Error("The requested resource was not found.");
      case 413:
        throw new Error("The file is too large to upload.");
      case 429:
        throw new Error("Too many requests. Please try again later.");
      case 500:
        throw new Error("Server error. Please try again later.");
      default:
        throw new Error(message || `Request failed with status ${status}`);
    }
  } else if (error.request) {
    // Network error
    throw new Error("Network error. Please check your connection and try again.");
  } else {
    // Other error
    throw new Error(error.message || "An unexpected error occurred.");
  }
};

// Export base clients and utilities for use in specific API modules
export { lzySvcApi, lzyDirectorApi, handleApiError, createApiClient };
