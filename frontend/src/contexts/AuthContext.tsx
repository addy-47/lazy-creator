import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { setAuthToken } from "@/lib/socket";

interface AuthContextType {
  isAuthenticated: boolean;
  isYouTubeConnected: boolean;
  username: string | undefined;
  setYouTubeConnected: (connected: boolean) => void;
  login: (token: string, user: any) => void;
  logout: () => void;
  refreshAuthState: () => void;
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
    const token = localStorage.getItem("token");
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

  // Check if user is already authenticated on mount
  useEffect(() => {
    refreshAuthState();
  }, []);

  const login = (token: string, user: any) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setAuthToken(token);
    setIsAuthenticated(true);
    setUsername(user.name);
  };

  const logout = () => {
    localStorage.removeItem("token");
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
