import axios from "axios";
import {
  shouldRefreshToken,
  refreshToken,
  getToken,
  SESSION_EXPIRED_EVENT,
} from "@/utils/tokenService";

/**
 * Centrally managed API base URL configuration.
 * Prioritizes VITE_API_URL and provides a generic fallback if not set.
 */
export const getAPIBaseURL = (): string => {
  return import.meta.env.VITE_API_URL || "/api";
};

// Legacy support for getWebSocketURL removed in favor of polling architecture.

/**
 * Core Axios instance for API communication.
 * Includes standardized headers, timeout, and interceptors for JWT management.
 */
export const api = axios.create({
  baseURL: getAPIBaseURL(),
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: false,
});

/**
 * Collection of helper methods to perform API requests without triggering preflight
 * by using token-in-query-parameter fallback for GET/DELETE where applicable.
 */
export const apiWithoutPreflight = {
  get: async (url: string, config?: any) => {
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
    const token = getToken();
    const separator = url.includes("?") ? "&" : "?";
    const tokenParam = token
      ? `${separator}token=${encodeURIComponent(token)}`
      : "";
    const fullUrl = `${url}${tokenParam}`;

    return api.delete(fullUrl, config);
  },
};

// Interceptor State
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

// Request Interceptor: Handles token refresh before requests if needed
api.interceptors.request.use(
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

// Response Interceptor: Handles 401 errors and triggers token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
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
            window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
          }

          return Promise.reject(error);
        }
      } catch (refreshError) {
        isRefreshing = false;
        processPendingRequests(null);
        console.error("Error during token refresh:", refreshError);

        if (!sessionExpiredNotificationShown) {
          sessionExpiredNotificationShown = true;
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Resets the session expiration notification flag.
 */
export const resetSessionExpiredFlag = () => {
  sessionExpiredNotificationShown = false;
};

/**
 * Helper to manually set or clear the auth token in axios headers.
 */
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common["x-access-token"] = token;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["x-access-token"];
    delete api.defaults.headers.common["Authorization"];
  }
};
