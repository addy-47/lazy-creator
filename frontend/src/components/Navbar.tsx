import { useState, useEffect, useReducer, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, Sun, Moon, LogIn, User, Youtube } from "lucide-react";
import { Button } from "@/components/Button";
import Logo from "./Logo";
import { AUTH_CHANGE_EVENT } from "../App";
import { useTheme } from "next-themes";
import { useLocation } from "react-router-dom";
import { setAuthToken } from "@/lib/socket";
import axios from "axios";
import { getAPIBaseURL } from "@/lib/socket";
import { useAuth } from "@/contexts/AuthContext";

interface NavbarProps {
  username?: string;
}

const Navbar = ({ username }: NavbarProps) => {
  // Add forceUpdate function to force re-renders
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | undefined>(
    undefined
  );

  // Initialize from props
  const { isAuthenticated, setYouTubeConnected, isYouTubeConnected } =
    useAuth();

  // Theme toggle
  const { setTheme, theme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Function to check and update the username directly from localStorage
  const updateUsernameFromStorage = () => {
    try {
      const userString = localStorage.getItem("user");
      if (userString) {
        const userData = JSON.parse(userString);
        setCurrentUsername(userData.name);
      } else {
        setCurrentUsername(undefined);
      }
    } catch (e) {
      console.error("Error parsing user data:", e);
      setCurrentUsername(undefined);
    }
  };

  // Check if connected to YouTube - with better error handling
  const checkYouTubeConnection = useCallback(async () => {
    if (!isAuthenticated) {
      console.log("YouTube check skipped - not authenticated");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.log("YouTube check skipped - no token");
      return;
    }

    try {
      console.log("Checking YouTube connection status...");

      // Use the consistent endpoint
      const endpoint = `${getAPIBaseURL()}/api/youtube-auth-status`;

      // Add error handling with retry
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        try {
          const response = await axios.get(endpoint, {
            headers: {
              "x-access-token": token,
            },
            // Add timeout to prevent hanging
            timeout: 5000,
          });

          if (response.data.authenticated || response.data.is_connected) {
            setYouTubeConnected(true);
            console.log("YouTube is connected");
          } else {
            setYouTubeConnected(false);
            console.log("YouTube is not connected");
          }

          // Success, exit the loop
          break;
        } catch (retryError) {
          attempts++;
          console.warn(`YouTube connection check attempt ${attempts} failed`);

          if (attempts >= maxAttempts) {
            throw retryError; // Rethrow the last error
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error("Error checking YouTube connection:", error);
      // Don't update the connected state on error - keep previous state
    }
  }, [isAuthenticated, setYouTubeConnected]);

  // Initialize username on mount and when prop changes
  useEffect(() => {
    updateUsernameFromStorage();
    if (username) {
      setCurrentUsername(username);
    }
    checkYouTubeConnection();
  }, [username]);

  // Listen for auth change events
  useEffect(() => {
    const handleAuthChange = () => {
      updateUsernameFromStorage();
      checkYouTubeConnection();
      forceUpdate(); // Force a re-render
    };

    // Listen for storage events and custom auth event
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);

    // Initial check
    updateUsernameFromStorage();
    checkYouTubeConnection();

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    };
  }, []);

  useEffect(() => {
    // Check user's preference
    const checkTheme = () => {
      if (
        localStorage.theme === "dark" ||
        (!("theme" in localStorage) &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        setIsDarkMode(true);
        document.documentElement.classList.add("dark");
        setTheme("dark");
      } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove("dark");
        setTheme("light");
      }

      // Also update username when theme changes
      updateUsernameFromStorage();
      forceUpdate();
    };

    checkTheme();

    // Listen for theme changes
    window.addEventListener("storage", checkTheme);

    // Handle scroll events
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("storage", checkTheme);
    };
  }, [setTheme]);

  const toggleDarkMode = () => {
    const newTheme = isDarkMode ? "light" : "dark";
    setTheme(newTheme);
    setIsDarkMode(!isDarkMode);
    localStorage.theme = newTheme;

    // Check username again after toggling theme
    updateUsernameFromStorage();
    forceUpdate();

    // Force the body to apply either dark or light class immediately
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }

    // Trigger event to inform other components about theme change
    window.dispatchEvent(new Event("storage"));
  };

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Create", path: "/create" },
    { name: "Gallery", path: "/gallery" },
  ];

  const handleSignOut = () => {
    // Remove user data and token
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    // Clear the auth token for API requests
    setAuthToken(null);

    setCurrentUsername(undefined);
    forceUpdate();

    // Trigger auth change event
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
    window.location.href = "/"; // Reload the page to update auth state
  };

  // Check auth status on every render
  const userData = localStorage.getItem("user");
  const userInfo = userData ? JSON.parse(userData) : null;
  const displayUsername =
    currentUsername || (userInfo ? userInfo.name : undefined);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/90 dark:bg-black/90 backdrop-blur-lg shadow-sm border-b border-border/50"
          : "bg-white/60 dark:bg-black/60 backdrop-blur-md"
      }`}
    >
      <div className="container-wide flex h-16 md:h-20 items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <NavLink
            to="/"
            className="text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            <span className="text-foreground">Lazy</span>
            <span className="text-[#E0115F]">Creator</span>
          </NavLink>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <div className="flex items-center space-x-6">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  isActive
                    ? "font-medium text-[#E0115F] dark:text-[#E0115F]"
                    : "text-foreground/80 hover:text-foreground transition-colors"
                }
              >
                {item.name}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full hover:bg-accent/10 transition-colors text-foreground"
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>

            {displayUsername ? (
              <div className="flex items-center space-x-4">
                {isYouTubeConnected && (
                  <div className="flex items-center gap-1 text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
                    <Youtube size={12} />
                    <span>Connected</span>
                  </div>
                )}
                <div className="relative group">
                  <button className="flex items-center gap-2 py-1 px-3 rounded-full bg-[#E0115F]/10 hover:bg-[#E0115F]/20 dark:hover:bg-[#E0115F]/20 transition-colors">
                    <User className="h-4 w-4 text-[#E0115F] dark:text-[#E0115F]" />
                    <span className="text-sm font-medium">
                      {displayUsername}
                    </span>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <NavLink to="/auth">
                <Button
                  size="sm"
                  className="bg-[#E0115F] hover:bg-[#E0115F]/90 rounded-full px-4 py-2 h-9"
                >
                  <div className="flex items-center space-x-2">
                    <LogIn size={16} />
                    <span>Sign In</span>
                  </div>
                </Button>
              </NavLink>
            )}
          </div>
        </div>

        {/* Mobile Navigation Toggle */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-foreground"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 shadow-lg">
          <div className="container-wide py-4 space-y-4">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg ${
                      isActive
                        ? "font-medium text-[#E0115F] dark:text-[#E0115F] bg-[#E0115F]/5 dark:bg-[#E0115F]/10"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
            </div>

            <hr className="border-gray-200 dark:border-gray-800" />

            <div className="flex flex-col space-y-3 px-4">
              <button
                onClick={toggleDarkMode}
                className="flex items-center gap-3 py-2"
              >
                {isDarkMode ? (
                  <div className="flex items-center space-x-2">
                    <Sun className="h-5 w-5" />
                    <span>Switch to Light Mode</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Moon className="h-5 w-5" />
                    <span>Switch to Dark Mode</span>
                  </div>
                )}
              </button>

              {displayUsername ? (
                <>
                  {isYouTubeConnected && (
                    <div className="flex items-center gap-2 py-2 text-sm text-green-600 dark:text-green-400">
                      <Youtube size={16} />
                      <span>YouTube Connected</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-5 w-5 text-[#E0115F]" />
                      <span>{displayUsername}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 py-2 text-red-600"
                  >
                    <div className="flex items-center space-x-2">
                      <LogIn className="h-5 w-5" />
                      <span>Sign Out</span>
                    </div>
                  </button>
                </>
              ) : (
                <NavLink
                  to="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 py-2"
                >
                  <div className="flex items-center space-x-2">
                    <LogIn className="h-5 w-5" />
                    <span>Sign In</span>
                  </div>
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
