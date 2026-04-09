import { createContext, useContext } from "react";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  isYouTubeConnected: boolean;
  username: string | undefined;
  user: UserProfile | null;
  setYouTubeConnected: (connected: boolean) => void;
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  refreshAuthState: () => void;
  refreshTokenIfNeeded: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
