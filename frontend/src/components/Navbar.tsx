import { useState, useEffect, useReducer } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, Sun, Moon, LogIn, User } from "lucide-react";
import { Button } from "./Button";
import Logo from "./Logo";
import { AUTH_CHANGE_EVENT } from "../App";
import { useTheme } from "next-themes";
import { useLocation } from "react-router-dom";
import { setAuthToken } from "@/lib/socket";

interface NavbarProps {
  username?: string;
}

const Navbar = ({ username }: NavbarProps) => {
  // Add forceUpdate function to force re-renders
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | undefined>(
    undefined
  );

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

  // Initialize username on mount and when prop changes
  useEffect(() => {
    updateUsernameFromStorage();
    if (username) {
      setCurrentUsername(username);
    }
  }, [username]);

  // Listen for auth change events
  useEffect(() => {
    const handleAuthChange = () => {
      updateUsernameFromStorage();
      forceUpdate(); // Force a re-render
    };

    // Listen for storage events and custom auth event
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);

    // Initial check
    updateUsernameFromStorage();

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
      } else {
        setIsDarkMode(false);
        document.documentElement.classList.remove("dark");
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
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
      setIsDarkMode(true);
    }

    // Check username again after toggling theme
    updateUsernameFromStorage();
    forceUpdate();

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
          ? "bg-white/80 dark:bg-black/80 backdrop-blur-lg shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="container-wide flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <NavLink
            to="/"
            className="text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            LazyCreator
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
                    ? "font-medium text-primary"
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
              className="p-2 rounded-full hover:bg-accent transition-colors"
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {displayUsername ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                  <User size={16} className="text-primary" />
                  <span className="text-sm font-medium">{displayUsername}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <NavLink to="/auth">
                <Button size="default" className="flex items-center gap-2">
                  <LogIn size={18} />
                  Sign In
                </Button>
              </NavLink>
            )}
          </div>
        </div>

        {/* Mobile Navigation Toggle */}
        <div className="flex items-center space-x-4 md:hidden">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-accent transition-colors"
            aria-label={
              isDarkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            className="p-2 rounded-md hover:bg-accent transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 top-16 z-40 bg-background animate-fade-in md:hidden">
          <div className="flex flex-col space-y-4 pt-8 px-6">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `py-2 text-lg ${
                    isActive
                      ? "font-medium text-primary"
                      : "text-foreground/80 hover:text-foreground"
                  }`
                }
                onClick={() => setIsMenuOpen(false)}
              >
                {item.name}
              </NavLink>
            ))}
            <div className="pt-4">
              {displayUsername ? (
                <>
                  <div className="flex items-center gap-2 mb-3 py-2">
                    <User size={18} className="text-primary" />
                    <span className="font-medium">{displayUsername}</span>
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <NavLink to="/auth" onClick={() => setIsMenuOpen(false)}>
                  <Button className="w-full" size="lg">
                    Sign In
                  </Button>
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
