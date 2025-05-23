import { ArrowRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "./Button";
import { useEffect, useRef, useState } from "react";
import StickFigureAnimation from "./StickFigureAnimation";

interface HeroProps {
  username?: string;
}

const Hero = ({ username }: HeroProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32"
    >
      <div className="container-tight relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Content column - left aligned */}
          <div className="lg:col-span-7 text-left space-y-8 pl-0 md:pl-0 lg:pl-0">
            {/* Enhanced welcome banner with glow effect */}
            {username ? (
              <div className="inline-block relative">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-[#E0115F] bg-[#E0115F]/10 border border-[#E0115F]/20 rounded-full shadow-sm shadow-[#E0115F]/10">
                  <span className="animate-pulse">👋</span>
                  Welcome {username}, ready to create effortless Shorts?
                </span>
              </div>
            ) : (
              <div className="inline-block relative">
                <span className="inline-flex items-center px-5 py-2 font-medium text-[#E0115F] bg-[#E0115F]/10 border border-[#E0115F]/20 rounded-full text-lg shadow-sm shadow-[#E0115F]/10">
                  Advanced Automation for YouTube Creators
                </span>
              </div>
            )}

            {/* Main heading with highlighted text and glow effect */}
            <h1
              className={`font-bold relative transition-all duration-1000 delay-300 max-w-3xl text-left scale-90 transform-gpu origin-left ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                textShadow: "0 0 30px rgba(224, 17, 95, 0.3)",
              }}
            >
              <span className="dark:text-white text-gray-800">
                Transform Your Content Creation
              </span>
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
                With AI-Powered Automation
              </span>
            </h1>

            <p
              className={`max-w-xl text-base dark:text-gray-300 text-gray-700 md:text-lg transition-all duration-1000 delay-500 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              Create professional YouTube Shorts without the tedious workflow.
              Our sophisticated AI handles everything from ideation to
              publishing, letting you scale your content creation effortlessly.
            </p>

            {/* Statistics row */}
            <div
              className={`grid grid-cols-3 gap-4 max-w-md transition-all duration-1000 delay-700 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <div className="text-left">
                <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#800000] to-[#E0115F]">
                  10x
                </div>
                <div className="text-sm text-gray-400">Faster Creation</div>
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#800000] to-[#E0115F]">
                  100%
                </div>
                <div className="text-sm text-gray-400">Automated</div>
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#800000] to-[#E0115F]">
                  24/7
                </div>
                <div className="text-sm text-gray-400">Content Pipeline</div>
              </div>
            </div>

            {/* CTA buttons with enhanced hover effects */}
            <div
              className={`flex flex-col sm:flex-row items-start gap-4 pt-4 transition-all duration-1000 delay-800 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              <NavLink to="/create">
                <Button
                  size="lg"
                  className="group relative overflow-hidden bg-gradient-to-r from-[#800000] to-[#E0115F] hover:shadow-lg hover:shadow-[#E0115F]/20 border-none text-white"
                >
                  <span className="relative z-10 flex items-center">
                    Start Creating
                    <ArrowRight
                      size={16}
                      className="ml-2 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                  <span className="absolute inset-0 w-0 bg-white/10 transition-all duration-300 group-hover:w-full"></span>
                </Button>
              </NavLink>
              <NavLink to="/learn">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-[#722F37] text-[#E0115F] hover:bg-[#722F37]/10 hover:shadow-lg hover:shadow-[#722F37]/10"
                >
                  Learn more
                </Button>
              </NavLink>
            </div>
          </div>

          {/* Visual showcase column - static phone mockups */}
          <div className="lg:col-span-5 hidden lg:block relative min-h-[400px]">
            {/* First phone mockup */}
            <div
              className={`absolute transition-all duration-1000 delay-1000 ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
              style={{
                willChange: "transform",
                top: "10%",
                left: "5%",
              }}
            >
              {/* Wrapper div to prevent border artifacts */}
              <div className="p-[0.5px]">
                <div className="w-52 h-96 rounded-2xl bg-black/50 backdrop-blur-sm shadow-[0_0_20px_rgba(224,17,95,0.2)] overflow-hidden relative">
                  {/* Inner gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#800000]/20 via-transparent to-[#E0115F]/20"></div>

                  {/* Border as pseudo-element to avoid rendering artifacts */}
                  <div className="absolute inset-0 rounded-2xl border border-[#E0115F]/30"></div>

                  {/* Home button indicator */}
                  <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <div className="w-16 h-1 bg-white/30 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Second phone mockup */}
            <div
              className={`absolute transition-all duration-1000 delay-1200 ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
              style={{
                willChange: "transform",
                top: "5%",
                left: "45%",
              }}
            >
              {/* Wrapper div to prevent border artifacts */}
              <div className="p-[0.5px]">
                <div className="w-44 h-80 rounded-2xl bg-black/50 backdrop-blur-sm shadow-[0_0_20px_rgba(114,47,55,0.2)] overflow-hidden relative">
                  {/* Inner gradient */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-[#722F37]/20 via-transparent to-black/50"></div>

                  {/* Border as pseudo-element to avoid rendering artifacts */}
                  <div className="absolute inset-0 rounded-2xl border border-[#722F37]/30"></div>

                  {/* Home button indicator */}
                  <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <div className="w-16 h-1 bg-white/30 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Third phone mockup */}
            <div
              className={`absolute transition-all duration-1000 delay-1400 ${
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
              }`}
              style={{
                willChange: "transform",
                top: "35%",
                left: "30%",
              }}
            >
              {/* Wrapper div to prevent border artifacts */}
              <div className="p-[0.5px]">
                <div className="w-48 h-88 rounded-2xl bg-black/50 backdrop-blur-sm shadow-[0_0_20px_rgba(128,0,0,0.2)] overflow-hidden relative">
                  {/* Inner gradient */}
                  <div className="absolute inset-0 bg-gradient-to-bl from-transparent via-[#800000]/10 to-black/50"></div>

                  {/* Border as pseudo-element to avoid rendering artifacts */}
                  <div className="absolute inset-0 rounded-2xl border border-[#800000]/30"></div>

                  {/* Home button indicator */}
                  <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <div className="w-16 h-1 bg-white/30 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
