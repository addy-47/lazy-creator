import React, { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import WorkflowProcess from "@/components/WorkflowProcess";
import Testimonials from "@/components/Testimonials";
import Statistics from "@/components/Statistics";
import { useAuth } from "@/contexts/AuthContext";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import { useTheme } from "next-themes";
import { rafScroll, addPassiveEventListener } from "@/utils/scroll";

const Index = () => {
  const { isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const scrollListenersRef = useRef<(() => void)[]>([]);

  // Optimized parallax scrolling effect with RAF
  useEffect(() => {
    // Using RAF for smooth animation
    const handleScroll = rafScroll(() => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);

      // Apply transform directly in RAF callback for better performance
      if (parallaxRef.current) {
        // Use transform3d for GPU acceleration
        parallaxRef.current.style.transform = `translate3d(0, ${
          currentScrollY * 0.3
        }px, 0)`;
      }
    });

    // Use passive event listener to improve scrolling performance
    const removeListener = addPassiveEventListener(
      window,
      "scroll",
      handleScroll
    );
    scrollListenersRef.current.push(removeListener);

    // Run once on mount to set initial position
    handleScroll();

    return () => {
      // Clean up all event listeners on unmount
      scrollListenersRef.current.forEach((remove) => remove());
      scrollListenersRef.current = [];
    };
  }, []);

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
      {/* Morphing background gradient overlay */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient - improved for both light and dark mode */}
        <div className="absolute inset-0 bg-gradient-to-br dark:from-[#800000]/20 dark:via-[#722F37]/10 dark:to-[#0A0A0A] light:from-[#FFF5F5] light:via-[#FFF0F0] light:to-[#FFFFFF]"></div>

        {/* Animated gradient */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl aspect-[3/1] bg-[#E0115F]/10 rounded-full blur-[100px] opacity-30 animate-breathe"></div>
          <div className="absolute bottom-0 left-1/4 w-full max-w-5xl aspect-[3/1] bg-[#800000]/15 rounded-full blur-[120px] opacity-20 animate-breathe delay-700"></div>
        </div>

        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[radial-gradient(#E0115F_1px,transparent_1px)] [background-size:30px_30px]"></div>
        </div>
      </div>

      {/* 3D Shorts visualization with will-change and transform3d for performance */}
      <div
        ref={parallaxRef}
        className="fixed right-0 top-0 h-full w-1/2 pointer-events-none -z-5 opacity-70 overflow-hidden"
        style={{
          willChange: "transform",
          transform: `translate3d(0, ${scrollY * 0.3}px, 0)`,
        }}
      >
        <div className="absolute right-10 top-40">
          <div className="relative w-40 h-72 rounded-2xl border border-[#E0115F]/30 bg-black/30 backdrop-blur-sm rotate-6 shadow-[0_0_15px_rgba(224,17,95,0.3)] transform-gpu hover:rotate-3 transition-transform duration-700">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/50 rounded-full"></div>
          </div>
        </div>
        <div className="absolute right-52 top-60">
          <div className="relative w-40 h-72 rounded-2xl border border-[#722F37]/30 bg-black/30 backdrop-blur-sm -rotate-3 shadow-[0_0_15px_rgba(114,47,55,0.3)] transform-gpu hover:rotate-0 transition-transform duration-700">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/50 rounded-full"></div>
          </div>
        </div>
        <div className="absolute right-20 top-[350px]">
          <div className="relative w-40 h-72 rounded-2xl border border-[#800000]/30 bg-black/30 backdrop-blur-sm rotate-12 shadow-[0_0_15px_rgba(128,0,0,0.3)] transform-gpu hover:rotate-6 transition-transform duration-700">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/50 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Stick figure animations - removed center ones, kept only corners */}
      <div className="fixed top-[20%] left-[5%] z-20 hidden md:block">
        <StickFigureAnimation type="wave" delay={300} height={90} />
      </div>
      <div className="fixed bottom-[20%] right-[5%] z-20 hidden md:block">
        <StickFigureAnimation type="jump" delay={1200} height={90} />
      </div>

      {/* Floating action button */}
      <div className="fixed bottom-10 right-10 z-50 transition-all duration-500 hover:scale-105">
        <button
          onClick={() => (window.location.href = "/create")}
          className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-r from-[#800000] to-[#E0115F] flex items-center justify-center shadow-[0_0_20px_rgba(224,17,95,0.5)] group"
        >
          <span className="text-white text-2xl font-bold group-hover:scale-110 transition-transform duration-300">
            +
          </span>
        </button>
      </div>

      <Navbar />

      <main className="flex-grow">
        <Hero />
        <Features />
        <WorkflowProcess />
        <Testimonials />
        <Statistics />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
