import axios, { 
  AxiosError, 
  AxiosResponse, 
  InternalAxiosRequestConfig 
} from "axios";
import {
  shouldRefreshToken,
  refreshToken,
  getToken,
  clearToken,
  emitSessionExpiredEvent,
} from "../tokenService";
import { getLzySvcBaseURL } from "../config";

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

// Interceptor State for token refresh
let isRefreshing = false;

interface PendingRequest {
  config: InternalAxiosRequestConfig;
  resolve: (value: AxiosResponse) => void;
  reject: (reason?: unknown) => void;
}

let pendingRequests: PendingRequest[] = [];
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
  async (config: InternalAxiosRequestConfig) => {
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
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);


// Response interceptor to handle 401 errors and token refresh
const responseInterceptor = (response: AxiosResponse) => response;
const errorInterceptor = async (error: AxiosError) => {
  const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

  if (
    error.response &&
    error.response.status === 401 &&
    !originalRequest._retry &&
    originalRequest.url !== "/refresh-token"
  ) {
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
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

/**
 * Resets the session expiration notification flag.
 */
export const resetSessionExpiredFlag = () => {
  sessionExpiredNotificationShown = false;
};

/**
 * Standardized error handler for API responses
 */
const handleApiError = (error: unknown): never => {
  if (axios.isAxiosError(error) && error.response) {
    // Server responded with error status
    const status = error.response.status;
    const message = (error.response.data as { message?: string })?.message || error.message;

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
  } else if (axios.isAxiosError(error) && error.request) {
    // Network error
    throw new Error("Network error. Please check your connection and try again.");
  } else {
    // Other error
    throw new Error((error as Error).message || "An unexpected error occurred.");
  }
};

// Export base clients and utilities for use in specific API modules
export { lzySvcApi, handleApiError, createApiClient };
