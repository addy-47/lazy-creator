import { useEffect, lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { 
  initializeTokenRefresh, 
  SESSION_EXPIRED_EVENT 
} from "@/services/tokenService";
import {
  NotificationProvider,
  useNotification,
} from "./contexts/NotificationContext";
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

// Lazy load pages for performance
const Index = lazy(() => import("./pages/Index"));
const Create = lazy(() => import("./pages/Create"));
const Auth = lazy(() => import("./pages/Auth"));
const Learn = lazy(() => import("./pages/learn"));
const Gallery = lazy(() => import("./pages/gallery"));
const Processing = lazy(() => import("./pages/Processing"));
const YouTubeAuthSuccess = lazy(() => import("./pages/YouTubeAuthSuccess"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOFService"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Create a custom event for auth changes
export const AUTH_CHANGE_EVENT = "auth-change";
export const YOUTUBE_CONNECTED_EVENT = "youtube-connected";

const queryClient = new QueryClient();

// Token refresh manager component
const TokenRefreshManager = () => {
  const { isAuthenticated, refreshTokenIfNeeded } = useAuth();

  useEffect(() => {
    // Only set up refresh if the user is authenticated
    if (!isAuthenticated) return;

    // Initial token refresh check
    refreshTokenIfNeeded();

    // Set up periodic token refresh check (every hour)
    const intervalId = setInterval(() => {
      refreshTokenIfNeeded();
    }, 60 * 60 * 1000); // 1 hour

    return () => {
      clearInterval(intervalId);
    };
  }, [isAuthenticated, refreshTokenIfNeeded]);

  return null; // This component doesn't render anything
};

// Session Expiration Handler component
const SessionExpirationHandler = () => {
  const { showSessionExpiredNotification } = useNotification();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Only set up listener if user is authenticated
    if (!isAuthenticated) return;

    // Function to handle session expiration
    const handleSessionExpired = () => {
      showSessionExpiredNotification();
    };

    // Add event listener for session expiration
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    // Cleanup listener when component unmounts
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [isAuthenticated, showSessionExpiredNotification]);

  return null; // This component doesn't render anything
};

const App = () => {
  // Initialize token refresh mechanism on app startup
  useEffect(() => {
    initializeTokenRefresh();
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
          <NotificationProvider>
            <TokenRefreshManager />
            <SessionExpirationHandler />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/create" element={<Create />} />
                    <Route path="/learn" element={<Learn />} />
                    <Route path="/gallery" element={<Gallery />} />
                    <Route path="/processing" element={<Processing />} />
                    <Route path="/youtube-auth-success" element={<YouTubeAuthSuccess />} />
                    <Route path="/terms-of-service" element={<TermsOfService />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/auth" element={<RouteWithAuth><Auth /></RouteWithAuth>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </NotificationProvider>
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

  return <>{children}</>;
};

export default App;
