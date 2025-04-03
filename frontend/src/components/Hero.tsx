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

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
      {/* Gradient overlay */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-background"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl aspect-[3/1] bg-purple-700/20 dark:bg-purple-700/10 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="container-tight relative">
        {/* Stick figure animations */}
        <div className="absolute -top-16 -right-10 hidden md:block">
          <StickFigureAnimation type="wave" delay={300} height={90} />
        </div>

        <div className="absolute top-1/2 -left-10 hidden md:block">
          <StickFigureAnimation type="dance" delay={600} height={90} />
        </div>

        <div className="absolute bottom-0 right-20 hidden md:block">
          <StickFigureAnimation type="sleep" delay={900} height={90} />
        </div>

        <div
          className={`text-center space-y-8 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Enhanced welcome banner with glow effect */}
          {username ? (
            <div className="inline-block relative">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full shadow-sm shadow-purple-500/10">
                <span className="animate-pulse">👋</span>
                Welcome {username}, ready to create effortless Shorts?
              </span>
            </div>
          ) : (
            <div className="inline-block relative">
              <span className="inline-flex items-center px-5 py-2 font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full text-xl shadow-sm shadow-purple-500/10">
                Less Work, More Content
              </span>
            </div>
          )}

          {/* Main heading with highlighted text and glow effect */}
          <h1
            className="font-bold relative transition-all duration-1000 delay-300"
            style={{
              textShadow: "0 0 30px rgba(147, 51, 234, 0.2)",
            }}
          >
            <span className="text-gray-900 dark:text-gray-100">
              Why Work Hard
            </span>
            <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-400 dark:to-purple-600">
              When AI Can Do It For You?
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-300 md:text-xl transition-all duration-1000 delay-500">
            Create professional YouTube Shorts without lifting a finger. Just
            pick a topic, let LazyCreator do the hard work, and take all the
            credit. It's content creation for the effortlessly successful.
          </p>

          {/* CTA buttons with enhanced hover effects */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 transition-all duration-1000 delay-700">
            <NavLink to="/create">
              <Button
                size="lg"
                variant="purple"
                className="group relative overflow-hidden"
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
                className="border-purple-300 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30"
              >
                Learn more
              </Button>
            </NavLink>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
