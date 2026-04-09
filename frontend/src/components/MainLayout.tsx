import Navbar from "./Navbar";
import Footer from "./Footer";
import { useTheme } from "next-themes";
import { useEffect, ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

/**
 * MainLayout provides a consistent structure and spacing for the application.
 * It ensures the fixed Navbar doesn't overlap with content and provides 
 * global padding-top.
 */
const MainLayout = ({ children, showFooter = true }: MainLayoutProps) => {
  const { theme, setTheme } = useTheme();

  // Consistent theme enforcement in the layout
  useEffect(() => {
    if (!theme) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setTheme(prefersDark ? "dark" : "light");
    }

    const applyTheme = () => {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else if (theme === "light") {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();
    const timeout = setTimeout(applyTheme, 50);
    return () => clearTimeout(timeout);
  }, [theme, setTheme]);

  return (
    <div className="min-h-screen flex flex-col pt-16 md:pt-5 transition-all duration-300 text-foreground overflow-x-hidden">
      {/* Centralized Global Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFF5F5]/70 via-[#FFF0F0]/80 to-white dark:from-[#800000]/10 dark:via-[#722F37]/5 dark:to-[#0A0A0A]"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-full max-w-3xl aspect-[3/1] bg-[#E0115F]/5 rounded-full blur-[100px] opacity-20 animate-breathe"></div>
          <div className="absolute bottom-1/4 left-1/4 w-full max-w-2xl aspect-[3/1] bg-[#800000]/10 rounded-full blur-[120px] opacity-10 animate-breathe delay-700"></div>
        </div>
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#E0115F_1px,transparent_1px)] [background-size:24px_24px]"></div>
        </div>
      </div>

      <Navbar />
      <main className="flex-grow relative z-10">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
};

MainLayout.displayName = "MainLayout";

export default MainLayout;
