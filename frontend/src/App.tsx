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
import Processing from "./pages/Processing";
import DebugLogin from "./pages/DebugLogin";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Create a custom event for auth changes
export const AUTH_CHANGE_EVENT = "auth-change";
export const YOUTUBE_CONNECTED_EVENT = "youtube-connected";

const queryClient = new QueryClient();

// Wrapper component for route transitions
const RouteTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  return (
    <PageTransition location={location.pathname}>{children}</PageTransition>
  );
};

const App = () => {
  // Initialize socket on mount
  useEffect(() => {
    (async () => {
      await initSocket();
    })();

    return () => {
      // Disconnect socket on unmount
      disconnectSocket();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
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
                      <Processing />
                    </RouteTransition>
                  }
                  path="/processing"
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
                    <RouteWithAuth>
                      <Auth />
                    </RouteWithAuth>
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
                <Route path="/debug-login" element={<DebugLogin />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

// Auth-protected route component
const RouteWithAuth = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  return <RouteTransition>{children}</RouteTransition>;
};

export default App;
