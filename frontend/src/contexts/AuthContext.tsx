import  {
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { 
  getToken, 
  setToken, 
  clearToken, 
  initializeTokenRefresh, 
  shouldRefreshToken, 
  refreshToken 
} from "@/services/tokenService";
import { AuthContext, type UserProfile } from "./use-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState<boolean>(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Simplified username getter for backward compatibility
  const username = useMemo(() => user?.name, [user]);

  // Function to refresh auth state from persistent storage
  const refreshAuthState = useCallback(() => {
    const token = getToken();
    const userJson = localStorage.getItem("user");

    if (token && userJson) {
      try {
        const userData = JSON.parse(userJson);
        setIsAuthenticated(true);
        setUser(userData);
      } catch (e) {
        console.error("Error parsing user data:", e);
        setIsAuthenticated(false);
        setUser(null);
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, []);

  // Function to refresh the token if needed
  const refreshTokenIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) return false;

    if (shouldRefreshToken()) {
      try {
        const newToken = await refreshToken();
        if (newToken) {
          console.log("Token refreshed successfully via AuthContext");
          return true;
        }
        return false;
      } catch (error) {
        console.error("Failed to refresh token:", error);
        return false;
      }
    }

    return false; // No refresh needed
  }, [isAuthenticated]);

  // Check if user is already authenticated on mount
  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  // Initialize token refresh mechanism
  useEffect(() => {
    if (isAuthenticated) {
      initializeTokenRefresh();
    }
  }, [isAuthenticated]);

  const login = useCallback((token: string, userData: UserProfile) => {
    setToken(token);
    localStorage.setItem("user", JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);

    // Initialize token refresh mechanism after login
    initializeTokenRefresh();
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem("user");
    // Clear session-specific transient flags too
    sessionStorage.clear(); 
    
    setIsAuthenticated(false);
    setIsYouTubeConnected(false);
    setUser(null);
  }, []);

  const setYouTubeConnected = useCallback((connected: boolean) => {
    setIsYouTubeConnected(connected);
  }, []);

  // Listen for messages from YouTube OAuth popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Basic security check: verify the message type
      if (event.data && event.data.type === 'YOUTUBE_AUTH_SUCCESS') {
        console.log("YouTube Auth success received from popup");
        setIsYouTubeConnected(true);
        // Dispatch custom event to trigger Navbar/Gallery refreshes
        window.dispatchEvent(new Event("YOUTUBE_CONNECTION_CHANGED"));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Memoize the context value as an optimization to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isAuthenticated,
    isYouTubeConnected,
    username,
    user,
    setYouTubeConnected,
    login,
    logout,
    refreshAuthState,
    refreshTokenIfNeeded,
  }), [
    isAuthenticated,
    isYouTubeConnected,
    username,
    user,
    setYouTubeConnected,
    login,
    logout,
    refreshAuthState,
    refreshTokenIfNeeded
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext, type UserProfile, type AuthContextType } from "./use-auth";
