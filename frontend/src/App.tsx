import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Create from "./pages/Create";
import Auth from "./pages/Auth";
import Learn from "./pages/learn";
import Gallery from "./pages/gallery";
import YouTubeAuthSuccess from "./pages/YouTubeAuthSuccess";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOFService";
import NotFound from "./pages/NotFound";
import { createContext, useEffect, useState, useCallback } from "react";
import PageTransition from "./components/PageTransition";
import { initSocket, disconnectSocket } from "./lib/socket";

// Create authentication context
export interface AuthContextType {
  isAuthenticated: boolean;
  username: string | undefined;
  refreshAuthState: () => void;
}

// Create a custom event for auth changes
export const AUTH_CHANGE_EVENT = "auth-change";

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: undefined,
  refreshAuthState: () => {},
});

const queryClient = new QueryClient();

// Wrapper component for route transitions
const RouteTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <PageTransition location={location.pathname}>{children}</PageTransition>
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | undefined>(undefined);

  const checkAuthStatus = useCallback(() => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        setIsAuthenticated(true);
        setUsername(userData.name);

        // Dispatch a custom event to notify components about auth change
        window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
      } catch (e) {
        console.error("Error parsing user data");
        setIsAuthenticated(false);
        setUsername(undefined);
      }
    } else {
      setIsAuthenticated(false);
      setUsername(undefined);
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    checkAuthStatus();

    // Initialize socket connection
    initSocket();

    // Listen for storage changes (for multi-tab support)
    window.addEventListener("storage", checkAuthStatus);
    // Listen for our custom auth change event
    window.addEventListener(AUTH_CHANGE_EVENT, checkAuthStatus);

    return () => {
      window.removeEventListener("storage", checkAuthStatus);
      window.removeEventListener(AUTH_CHANGE_EVENT, checkAuthStatus);
      // Disconnect socket on unmount
      disconnectSocket();
    };
  }, [checkAuthStatus]);

  const authValue = {
    isAuthenticated,
    username,
    refreshAuthState: checkAuthStatus,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthContext.Provider value={authValue}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route
                  element={
                    <RouteTransition>
                      <Index />
                    </RouteTransition>
                  }
                  path="/"
                />
                <Route
                  element={
                    <RouteTransition>
                      <Create />
                    </RouteTransition>
                  }
                  path="/create"
                />
                <Route
                  element={
                    <RouteTransition>
                      <Learn />
                    </RouteTransition>
                  }
                  path="/learn"
                />
                <Route
                  element={
                    <RouteTransition>
                      <Gallery />
                    </RouteTransition>
                  }
                  path="/gallery"
                />
                <Route
                  element={
                    <RouteTransition>
                      <YouTubeAuthSuccess />
                    </RouteTransition>
                  }
                  path="/youtube-auth-success"
                />
                <Route
                  element={
                    <RouteTransition>
                      <TermsOfService />
                    </RouteTransition>
                  }
                  path="/terms-of-service"
                />
                <Route
                  element={
                    <RouteTransition>
                      <PrivacyPolicy />
                    </RouteTransition>
                  }
                  path="/privacy-policy"
                />
                <Route
                  path="/auth"
                  element={
                    isAuthenticated ? (
                      <Navigate to="/" />
                    ) : (
                      <RouteTransition>
                        <Auth />
                      </RouteTransition>
                    )
                  }
                />
                <Route
                  element={
                    <RouteTransition>
                      <NotFound />
                    </RouteTransition>
                  }
                  path="*"
                />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
