import axios from "axios";
import { getAPIBaseURL } from "./config";

// Token refresh constants
const TOKEN_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const TOKEN_REFRESH_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 days before expiration
const TOKEN_KEY = "token";
const TOKEN_EXPIRY_KEY = "token_expiry";

// Session expiration event name
export const SESSION_EXPIRED_EVENT = "session_expired";

// Decode JWT token to get payload data
export const decodeToken = (token: string): any => {
  try {
    // The JWT token consists of three parts separated by dots: header.payload.signature
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
};

// Store the token and its expiry time
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);

  // Extract expiry time from token and store it
  const decodedToken = decodeToken(token);
  if (decodedToken && decodedToken.exp) {
    // JWT exp is in seconds, convert to milliseconds for Date
    const expiryTime = decodedToken.exp * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }
};

// Get the stored token
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

// Get token expiry time as a number (milliseconds)
export const getTokenExpiry = (): number | null => {
  const expiryTimeStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiryTimeStr ? parseInt(expiryTimeStr, 10) : null;
};

// Clear token and related data
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

// Check if token is expired
export const isTokenExpired = (): boolean => {
  const expiryTime = getTokenExpiry();
  if (!expiryTime) return true; // No expiry time, consider expired

  return Date.now() > expiryTime;
};

// Emit session expired event
export const emitSessionExpiredEvent = (): void => {
  const event = new CustomEvent(SESSION_EXPIRED_EVENT);
  window.dispatchEvent(event);
};

// Check if token needs refresh
export const shouldRefreshToken = (): boolean => {
  const expiryTime = getTokenExpiry();
  if (!expiryTime) return false;

  // Calculate time remaining until expiry
  const now = Date.now();
  const timeRemaining = expiryTime - now;

  // Return true if token is within refresh threshold
  return timeRemaining > 0 && timeRemaining < TOKEN_REFRESH_THRESHOLD;
};

// Refresh the token
export const refreshToken = async (): Promise<string | null> => {
  const currentToken = getToken();
  if (!currentToken) return null;

  try {
    const response = await axios.post(
      `${getAPIBaseURL()}/api/refresh-token`,
      {},
      {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.token) {
      // Store the new token
      setToken(response.data.token);
      console.log("Token refreshed successfully");
      return response.data.token;
    }

    console.error("Token refresh response missing token");
    return null;
  } catch (error) {
    console.error("Error refreshing token:", error);

    // Check if the error is due to an expired session
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Emit session expired event
      emitSessionExpiredEvent();
    }

    return null;
  }
};

// Initialize token refresh logic
export const initializeTokenRefresh = (): void => {
  // Initial check for token refresh
  if (shouldRefreshToken()) {
    refreshToken().catch((error) => {
      console.error("Failed to refresh token during initialization:", error);
    });
  }

  // Set up periodic checks for token refresh
  setInterval(() => {
    if (shouldRefreshToken()) {
      refreshToken().catch((error) => {
        console.error("Failed to refresh token during interval check:", error);
      });
    }
  }, TOKEN_REFRESH_INTERVAL);
};

// Validate token and handle expiration
export const validateToken = (): boolean => {
  const token = getToken();
  if (!token) return false;

  if (isTokenExpired()) {
    emitSessionExpiredEvent();
    return false;
  }

  return true;
};
