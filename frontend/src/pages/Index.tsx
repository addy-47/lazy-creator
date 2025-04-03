import { useContext, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import { AuthContext } from "../App";
import WorkflowProcess from "@/components/WorkflowProcess";
import Testimonials from "@/components/Testimonials";
import Statistics from "@/components/Statistics";

const Index = () => {
  const { username, refreshAuthState } = useContext(AuthContext);

  // Refresh auth state when component mounts
  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Enhanced animated background with purple and black gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-purple-900/30 via-background to-background dark:from-purple-900/20 dark:via-background/95 dark:to-background">
        <div className="absolute inset-0 opacity-20 dark:opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#9333ea_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>

        {/* Animated subtle video frames representing content creation */}
        <div className="absolute inset-0 overflow-hidden opacity-10 dark:opacity-5 pointer-events-none">
          <div className="absolute top-0 left-0 w-[200%] h-[200%] -translate-y-1/2 animate-infinite-scroll-y-reverse">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-20 h-36 md:w-28 md:h-48 rounded-md border border-purple-400/20"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  transform: `rotate(${Math.random() * 20 - 10}deg)`,
                  opacity: Math.random() * 0.5 + 0.1,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <Navbar username={username} />

      <main className="flex-grow">
        <Hero username={username} />
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
