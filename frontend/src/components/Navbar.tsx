import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, Sun, Moon, LogIn, User } from "lucide-react";
import { Button } from "./Button";
import Logo from "./Logo";

interface NavbarProps {
  username?: string;
}

const Navbar = ({ username }: NavbarProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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
    };

    checkTheme();

    // Listen for theme changes from other components
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
    // Trigger event to inform other components about theme change
    window.dispatchEvent(new Event("storage"));
  };

  const navItems = [
    { name: "Home", path: "/" },
    { name: "Create", path: "/create" },
    { name: "Gallery", path: "/gallery" },
  ];

  const handleSignOut = () => {
    localStorage.removeItem("user");
    window.location.href = "/"; // Reload the page to update auth state
  };

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

            {username ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                  <User size={16} className="text-primary" />
                  <span className="text-sm font-medium">{username}</span>
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
              {username ? (
                <>
                  <div className="flex items-center gap-2 mb-3 py-2">
                    <User size={18} className="text-primary" />
                    <span className="font-medium">{username}</span>
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
