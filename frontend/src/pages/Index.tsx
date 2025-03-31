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

        {/* Add just two subtle stick figure animations */}
        <div className="container-wide relative my-12">
          <div className="absolute right-5 top-1/2 -translate-y-1/2 hidden md:block">
            <StickFigureAnimation type="wave" delay={450} height={70} />
          </div>

          <div className="absolute left-5 bottom-0 hidden md:block">
            <StickFigureAnimation type="dance" delay={750} height={70} />
          </div>
        </div>

        <Features />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
