import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { refreshToken, shouldRefreshToken } from "@/utils/tokenService";
import { setAuthToken } from "@/lib/socket";

/**
 * Hook for refreshing the auth token when needed
 * Returns functions and state for managing token refresh
 */
export const useTokenRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refreshAuthState } = useAuth();

  /**
   * Check if token needs refresh and refresh it if necessary
   * @returns Promise<boolean> - Whether the token was refreshed successfully
   */
  const checkAndRefreshToken = useCallback(async () => {
    // Check if token needs refresh
    if (!shouldRefreshToken()) {
      return false; // No refresh needed
    }

    // Start refresh process
    setIsRefreshing(true);

    try {
      // Attempt to refresh the token
      const newToken = await refreshToken();

      if (newToken) {
        // Update axios auth headers
        setAuthToken(newToken);
        // Update auth context
        refreshAuthState();
        setIsRefreshing(false);
        return true;
      }

      setIsRefreshing(false);
      return false;
    } catch (error) {
      console.error("Error refreshing token:", error);
      setIsRefreshing(false);
      return false;
    }
  }, [refreshAuthState]);

  /**
   * Force token refresh regardless of expiration time
   * @returns Promise<boolean> - Whether the token was refreshed successfully
   */
  const forceTokenRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const newToken = await refreshToken();

      if (newToken) {
        // Update axios auth headers
        setAuthToken(newToken);
        // Update auth context
        refreshAuthState();
        setIsRefreshing(false);
        return true;
      }

      setIsRefreshing(false);
      return false;
    } catch (error) {
      console.error("Error forcing token refresh:", error);
      setIsRefreshing(false);
      return false;
    }
  }, [refreshAuthState]);

  return {
    checkAndRefreshToken,
    forceTokenRefresh,
    isRefreshing,
  };
};
