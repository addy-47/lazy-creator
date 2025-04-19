import React, { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CreateForm from "@/components/CreateForm";
import { useAuth } from "@/contexts/AuthContext";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import { useTheme } from "next-themes";

const Create = () => {
  const { isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();

  // Improved theme handling - force document class update
  useEffect(() => {
    // If theme is not set, detect browser preference
    if (!theme) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setTheme(prefersDark ? "dark" : "light");
    }

    // Ensure the theme is applied to the document
    const applyTheme = () => {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    };

    // Apply immediately
    applyTheme();

    // Also apply after a short delay to ensure all components update
    const timeout = setTimeout(applyTheme, 50);

    return () => clearTimeout(timeout);
  }, [theme, setTheme]);

  // Force-apply theme immediately on render
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  } else if (theme === "light") {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
  }

  return (
    <div className="min-h-screen flex flex-col overflow-hidden text-foreground">
      {/* Enhanced animated background */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient - improved for both light and dark mode */}
        <div className="absolute inset-0 bg-gradient-to-br dark:from-[#800000]/10 dark:via-[#722F37]/5 dark:to-[#0A0A0A] light:from-[#FFF5F5]/70 light:via-[#FFF0F0]/80 light:to-white"></div>

        {/* Animated gradient */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-full max-w-3xl aspect-[3/1] bg-[#E0115F]/5 rounded-full blur-[100px] opacity-20 animate-breathe"></div>
          <div className="absolute bottom-1/4 left-1/4 w-full max-w-2xl aspect-[3/1] bg-[#800000]/10 rounded-full blur-[120px] opacity-10 animate-breathe delay-700"></div>
        </div>

        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#E0115F_1px,transparent_1px)] [background-size:24px_24px]"></div>
        </div>
      </div>

      {/* Single subtle stick figure animation */}
      <div className="fixed bottom-10 left-10 z-10 hidden md:block opacity-60">
        <StickFigureAnimation type="dance" delay={500} height={70} />
      </div>

      <Navbar />

      <main className="flex-grow relative pt-24 md:pt-32">
        <div className="container max-w-5xl mx-auto px-4 md:px-6 relative z-10">
          <div className="text-left md:text-center mb-10">
            <div className="inline-block px-4 py-1 mb-4 text-sm font-medium text-[#E0115F] bg-[#E0115F]/10 dark:bg-[#E0115F]/5 border border-[#E0115F]/20 rounded-full">
              AI-Powered Creation
            </div>
            <h1 className="text-3xl md:text-4xl font-bold dark:text-white light:text-gray-800 mb-4 leading-tight">
              Unleash Creative Sloth Mode
              <span className="text-[#E0115F]">.</span>
            </h1>
            <p className="text-base md:text-lg dark:text-gray-400 light:text-gray-600 max-w-2xl mx-auto">
              Let AI do the heavy lifting while you kick back. Transform scripts
              into viral shorts without lifting a finger. Your inner laziness
              has never been so productive.
            </p>
          </div>

          <div className="relative">
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-20 h-20 border border-[#E0115F]/20 rounded-full blur-md opacity-30 dark:opacity-20"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 border border-[#800000]/20 rounded-full blur-md opacity-30 dark:opacity-20"></div>

            {/* Form container with enhanced styling */}
            <div className="glass-card-ruby p-6 md:p-8 relative z-20">
              <CreateForm />
            </div>
          </div>
        </div>
      </main>

      {/* Added spacing before footer */}
      <div className="py-16 md:py-20"></div>

      <Footer />
    </div>
  );
};

export default Create;
