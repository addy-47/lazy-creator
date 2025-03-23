
import { useLocation, NavLink } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/Button";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import Logo from "@/components/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Enhanced background with gradient and pattern */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>
      
      <div className="text-center px-4 max-w-md mx-auto relative">
        <div className="mb-6 flex justify-center">
          <Logo size="large" showText={true} />
        </div>
      
        <h1 className="text-9xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-medium mb-4">Page not found</h2>
        <p className="text-foreground/70 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <NavLink to="/">
          <Button>Return to Home</Button>
        </NavLink>
        
        {/* Add stick figure animations */}
        <div className="absolute top-0 -right-20 hidden md:block">
          <StickFigureAnimation type="sleep" delay={300} height={70} />
        </div>
        
        <div className="absolute bottom-0 -left-20 hidden md:block">
          <StickFigureAnimation type="stretch" delay={500} height={70} />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
