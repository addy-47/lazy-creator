import { useContext, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import { AuthContext } from "../App";

const Index = () => {
  const { username, refreshAuthState } = useContext(AuthContext);

  // Refresh auth state when component mounts
  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Enhanced background with gradient and pattern */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>

      <Navbar username={username} />
      <main className="flex-grow">
        <Hero username={username} />

        {/* Add more stick figure animations throughout the page */}
        <div className="container-wide relative my-12">
          <div className="absolute -right-10 top-1/2 -translate-y-1/2 hidden md:block">
            <StickFigureAnimation type="jump" delay={300} height={80} />
          </div>

          <div className="absolute -left-10 top-1/2 -translate-y-1/2 hidden md:block">
            <StickFigureAnimation type="sleep" delay={600} height={80} />
          </div>

          {/* Add new animations */}
          <div className="absolute right-1/4 top-0 hidden md:block">
            <StickFigureAnimation type="wave" delay={450} height={80} />
          </div>

          <div className="absolute left-1/4 bottom-0 hidden md:block">
            <StickFigureAnimation type="spin" delay={750} height={80} />
          </div>
        </div>

        <Features />

        {/* Add even more stick figures */}
        <div className="container-wide relative mt-16 mb-8">
          <div className="absolute left-10 bottom-0 hidden md:block">
            <StickFigureAnimation type="dance" delay={900} height={80} />
          </div>

          <div className="absolute right-10 bottom-0 hidden md:block">
            <StickFigureAnimation type="stretch" delay={1200} height={80} />
          </div>

          {/* Add new animations */}
          <div className="absolute left-1/3 top-0 hidden md:block">
            <StickFigureAnimation type="peek" delay={1050} height={80} />
          </div>

          <div className="absolute right-1/3 top-1/2 hidden md:block">
            <StickFigureAnimation type="jump" delay={1350} height={80} />
          </div>

          <div className="absolute left-1/4 top-1/2 hidden md:block">
            <StickFigureAnimation type="sleep" delay={1500} height={80} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
