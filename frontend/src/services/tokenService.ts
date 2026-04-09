
import axios from "axios";
import { getLzySvcBaseURL } from "./config";

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

  const decodedToken = decodeToken(token);
  if (decodedToken && decodedToken.exp) {
    const expiryTime = decodedToken.exp * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }
};

// Get the stored token
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

// Get token expiry time
export const getTokenExpiry = (): number | null => {
  const expiryTimeStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiryTimeStr ? parseInt(expiryTimeStr, 10) : null;
};

// Clear token data
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

// Check if token is expired
export const isTokenExpired = (): boolean => {
  const expiryTime = getTokenExpiry();
  if (!expiryTime) return true;
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

  const now = Date.now();
  const timeRemaining = expiryTime - now;

  return timeRemaining > 0 && timeRemaining < TOKEN_REFRESH_THRESHOLD;
};

// Refresh the token via the backend
export const refreshToken = async (): Promise<string | null> => {
  const currentToken = getToken();
  if (!currentToken) return null;

  try {
    const response = await axios.post(
      `${getLzySvcBaseURL()}/auth/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.token) {
      setToken(response.data.token);
      return response.data.token;
    }
    return null;
  } catch (error) {
    console.error("Error refreshing token:", error);
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      emitSessionExpiredEvent();
    }
    return null;
  }
};

// Set up periodic checks for token refresh
export const initializeTokenRefresh = (): void => {
  if (shouldRefreshToken()) {
    refreshToken().catch(console.error);
  }

  setInterval(() => {
    if (shouldRefreshToken()) {
      refreshToken().catch(console.error);
    }
  }, TOKEN_REFRESH_INTERVAL);
};
