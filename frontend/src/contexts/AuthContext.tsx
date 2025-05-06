import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { setAuthToken, resetSessionExpiredFlag } from "@/lib/socket";
import {
  getToken,
  setToken,
  clearToken,
  initializeTokenRefresh,
  shouldRefreshToken,
  refreshToken,
} from "@/utils/tokenService";

interface AuthContextType {
  isAuthenticated: boolean;
  isYouTubeConnected: boolean;
  username: string | undefined;
  setYouTubeConnected: (connected: boolean) => void;
  login: (token: string, user: any) => void;
  logout: () => void;
  refreshAuthState: () => void;
  refreshTokenIfNeeded: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState<boolean>(false);
  const [username, setUsername] = useState<string | undefined>(undefined);

  // Function to refresh auth state
  const refreshAuthState = () => {
    const token = getToken();
    const user = localStorage.getItem("user");

    if (token && user) {
      try {
        const userData = JSON.parse(user);
        setIsAuthenticated(true);
        setUsername(userData.name);
        setAuthToken(token);
      } catch (e) {
        console.error("Error parsing user data:", e);
        setIsAuthenticated(false);
        setUsername(undefined);
      }
    } else {
      setIsAuthenticated(false);
      setUsername(undefined);
    }
  };

  // Function to refresh the token if needed
  const refreshTokenIfNeeded = async (): Promise<boolean> => {
    if (!isAuthenticated) return false;

    if (shouldRefreshToken()) {
      try {
        const newToken = await refreshToken();
        if (newToken) {
          setAuthToken(newToken);
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
  };

  // Initialize token refresh mechanism
  useEffect(() => {
    if (isAuthenticated) {
      initializeTokenRefresh();
    }
  }, [isAuthenticated]);

  // Check if user is already authenticated on mount
  useEffect(() => {
    refreshAuthState();
  }, []);

  const login = (token: string, user: any) => {
    setToken(token);
    localStorage.setItem("user", JSON.stringify(user));
    setAuthToken(token);
    setIsAuthenticated(true);
    setUsername(user.name);

    // Reset session expired flag
    resetSessionExpiredFlag();

    // Initialize token refresh mechanism after login
    initializeTokenRefresh();
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem("user");
    setAuthToken(null);
    setIsAuthenticated(false);
    setIsYouTubeConnected(false);
    setUsername(undefined);
  };

  const setYouTubeConnected = (connected: boolean) => {
    setIsYouTubeConnected(connected);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isYouTubeConnected,
        username,
        setYouTubeConnected,
        login,
        logout,
        refreshAuthState,
        refreshTokenIfNeeded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
