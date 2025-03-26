import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { createContext, useEffect, useState } from "react";

// Create authentication context
export interface AuthContextType {
  isAuthenticated: boolean;
  username: string | undefined;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  username: undefined,
});

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | undefined>(undefined);

  useEffect(() => {
    const checkAuthStatus = () => {
      const user = localStorage.getItem("user");
      if (user) {
        try {
          const userData = JSON.parse(user);
          setIsAuthenticated(true);
          setUsername(userData.name);
        } catch (e) {
          console.error("Error parsing user data");
          setIsAuthenticated(false);
          setUsername(undefined);
        }
      } else {
        setIsAuthenticated(false);
        setUsername(undefined);
      }
    };

    checkAuthStatus();

    // Listen for storage changes (for multi-tab support)
    window.addEventListener("storage", checkAuthStatus);

    return () => {
      window.removeEventListener("storage", checkAuthStatus);
    };
  }, []);

  const authValue = {
    isAuthenticated,
    username,
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
                <Route path="/" element={<Index />} />
                <Route path="/create" element={<Create />} />
                <Route path="/learn" element={<Learn />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route
                  path="/youtube-auth-success"
                  element={<YouTubeAuthSuccess />}
                />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route
                  path="/auth"
                  element={isAuthenticated ? <Navigate to="/" /> : <Auth />}
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
