import { useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/use-auth";
import { 
  initializeTokenRefresh, 
} from "@/services/tokenService";
import { 
  SESSION_EXPIRED_EVENT 
} from "@/utils/events";
import { NotificationProvider } from "./contexts/NotificationContext";
import { useNotification } from "./contexts/use-notification";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "next-themes";

// Lazy load pages for performance
const Index = lazy(() => import("./pages/Index"));
const Create = lazy(() => import("./pages/Create"));
const Auth = lazy(() => import("./pages/Auth"));
const Learn = lazy(() => import("./pages/Learn"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Processing = lazy(() => import("./pages/Processing"));
const YouTubeAuthSuccess = lazy(() => import("./pages/YouTubeAuthSuccess"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

// Use constants from @/utils/events

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

import MainLayout from "@/components/MainLayout";

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
                    {/* Routes that use the shared Layout */}
                    <Route path="/" element={<MainLayout><Index /></MainLayout>} />
                    <Route path="/create" element={<MainLayout><Create /></MainLayout>} />
                    <Route path="/learn" element={<MainLayout><Learn /></MainLayout>} />
                    <Route path="/gallery" element={<MainLayout><Gallery /></MainLayout>} />
                    <Route path="/processing" element={<MainLayout><Processing /></MainLayout>} />
                    <Route path="/youtube-auth-success" element={<MainLayout showFooter={false}><YouTubeAuthSuccess /></MainLayout>} />
                    
                    {/* Routes that use the shared layout (Auth also gets it for consistency) */}
                    <Route path="/auth" element={<RouteWithAuth><MainLayout showFooter={false}><Auth /></MainLayout></RouteWithAuth>} />
                    
                    <Route path="/terms-of-service" element={<MainLayout><TermsOfService /></MainLayout>} />
                    <Route path="/privacy-policy" element={<MainLayout><PrivacyPolicy /></MainLayout>} />
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
