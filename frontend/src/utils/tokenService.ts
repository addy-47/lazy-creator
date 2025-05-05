import axios from "axios";
import { getAPIBaseURL } from "./config";

// Token refresh constants
const TOKEN_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const TOKEN_REFRESH_THRESHOLD = 3 * 24 * 60 * 60 * 1000; // 3 days before expiration
const TOKEN_KEY = "token";
const TOKEN_EXPIRY_KEY = "token_expiry";

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

// Get token from local storage
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

// Get token expiry time
export const getTokenExpiry = (): number => {
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (storedExpiry) {
    return parseInt(storedExpiry);
  }

  // If not stored explicitly, try to get from token
  const token = getToken();
  if (token) {
    const decoded = decodeToken(token);
    if (decoded && decoded.exp) {
      // exp is in seconds, convert to milliseconds
      const expiryTime = decoded.exp * 1000;
      // Save for future reference
      setTokenExpiry(expiryTime);
      return expiryTime;
    }
  }

  return 0;
};

// Set token in local storage
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);

  // Extract and store expiration time
  const decoded = decodeToken(token);
  if (decoded && decoded.exp) {
    setTokenExpiry(decoded.exp * 1000);
  }
};

// Set token expiry time
export const setTokenExpiry = (expiryTime: number): void => {
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
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
      `${getAPIBaseURL()}/refresh-token`,
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

// Clear token from local storage
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};
