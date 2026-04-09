import { useEffect, useRef, useState } from "react";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import WorkflowProcess from "@/components/WorkflowProcess";
import Testimonials from "@/components/Testimonials";
import Statistics from "@/components/Statistics";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import { rafScroll, addPassiveEventListener } from "@/utils/scroll";

const Index = () => {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const scrollListenersRef = useRef<(() => void)[]>([]);

  // Optimized parallax scrolling effect with RAF
  // Re-enabled for testing
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


  return (
    <>
      {/* 3D Shorts visualization with will-change and transform3d for performance */}
      <div
        ref={parallaxRef}
        className="fixed right-0 top-0 h-full w-[70%] md:w-1/2 pointer-events-none -z-5 opacity-70 overflow-hidden"
        style={{
          willChange: "transform",
          transform: `translate3d(0, ${scrollY * 0.3}px, 0)`,
        }}
      >
        <div className="absolute right-[5%] md:right-10 top-40">
          <div className="relative w-[20vw] md:w-40 aspect-[10/16] rounded-2xl border border-[#E0115F]/30 bg-black/30 backdrop-blur-sm rotate-6 shadow-[0_0_15px_rgba(224,17,95,0.3)] transform-gpu hover:rotate-3 transition-transform duration-700">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/50 rounded-full"></div>
          </div>
        </div>
        <div className="absolute right-[35%] md:right-52 top-60">
          <div className="relative w-[20vw] md:w-40 aspect-[10/16] rounded-2xl border border-[#722F37]/30 bg-black/30 backdrop-blur-sm -rotate-3 shadow-[0_0_15px_rgba(114,47,55,0.3)] transform-gpu hover:rotate-0 transition-transform duration-700">
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/50 rounded-full"></div>
          </div>
        </div>
        <div className="absolute right-[15%] md:right-20 top-[350px]">
          <div className="relative w-[20vw] md:w-40 aspect-[10/16] rounded-2xl border border-[#800000]/30 bg-black/30 backdrop-blur-sm rotate-12 shadow-[0_0_15px_rgba(128,0,0,0.3)] transform-gpu hover:rotate-6 transition-transform duration-700">
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

      <div className="relative">
        <Hero />
        <Features />
        <WorkflowProcess />
        <Testimonials />
        {/* Statistics optimized for performance */}
        <Statistics />
      </div>
    </>
  );
};

export default Index;
