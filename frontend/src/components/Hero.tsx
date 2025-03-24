import { ArrowRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Button } from "./Button";
import VideoDemo from "./VideoDemo";
import StickFigureAnimation from "./StickFigureAnimation";
interface HeroProps {
  username?: string;
}
const Hero = ({ username }: HeroProps) => {
  return (
    <section className="relative overflow-hidden pt-36 pb-16 md:pt-40 md:pb-24">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl aspect-[3/1] bg-primary/20 dark:bg-primary/10 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="container-tight">
        <div className="text-center space-y-8 animate-slide-up [animation-delay:200ms]">
          {username ? (
            <div className="inline-block relative">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-full">
                <span className="animate-pulse">👋</span>
                Welcome {username}, start your journey of creating effortless
                YouTube Shorts
              </span>
              {/* Add stick figure animation */}
              <div className="absolute -top-10 -right-12 hidden md:block">
                <StickFigureAnimation type="wave" delay={300} height={80} />
              </div>
            </div>
          ) : (
            <div className="inline-block relative">
              <span className="inline-flex items-center px-3 py-1 font-medium text-primary bg-primary/10 rounded-full text-xl">
                Effortless YouTube Shorts
              </span>
              {/* Add stick figure animation - removed the left one, kept only the right one */}
              <div className="absolute -top-10 -right-12 hidden md:block">
                <StickFigureAnimation type="wave" delay={300} height={80} />
              </div>
            </div>
          )}

          <h1 className="font-bold relative">
            Create Stunning YouTube Shorts
            <span className="block mt-2 text-primary">Without the Effort</span>
            {/* Add stick figure animation behind "Without the Effort" */}
            <div className="absolute -right-14 top-1/2 hidden md:block">
              <StickFigureAnimation type="peek" delay={900} height={80} />
            </div>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-foreground/70 md:text-xl">
            Transform your ideas into engaging YouTube Shorts in minutes. No
            editing skills required. Just select a prompt, customize your
            options, and let LazyCreator do the rest.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative">
            <NavLink to="/create">
              <Button size="lg" className="group">
                Start Creating
                <ArrowRight
                  size={16}
                  className="ml-2 transition-transform group-hover:translate-x-0.5"
                />
              </Button>
            </NavLink>
            <NavLink to="/learn">
              <Button variant="outline" size="lg">
                Learn more
              </Button>
            </NavLink>

            {/* Add stick figure animations near the buttons */}
            <div className="absolute -bottom-20 -right-10 hidden md:block">
              <StickFigureAnimation type="dance" delay={1200} height={80} />
            </div>
            <div className="absolute -bottom-20 -left-10 hidden md:block">
              <StickFigureAnimation type="jump" delay={1500} height={80} />
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24 animate-fade-in [animation-delay:600ms] relative">
          <div className="glass-card aspect-video max-w-4xl mx-auto overflow-hidden">
            <VideoDemo />
          </div>

          {/* Animated stick figures positioned around the video demo */}
          <div className="absolute -top-8 right-8 hidden md:block">
            <StickFigureAnimation type="peek" delay={1000} height={80} />
          </div>

          <div className="absolute -bottom-8 left-8 hidden md:block">
            <StickFigureAnimation type="wave" delay={2000} height={80} />
          </div>

          {/* Add more stick figures around the video */}
          <div className="absolute top-1/2 -right-12 -translate-y-1/2 hidden md:block">
            <StickFigureAnimation type="stretch" delay={1800} height={80} />
          </div>

          <div className="absolute top-1/2 -left-12 -translate-y-1/2 hidden md:block">
            <StickFigureAnimation type="sleep" delay={2200} height={80} />
          </div>
        </div>
      </div>
    </section>
  );
};
export default Hero;
