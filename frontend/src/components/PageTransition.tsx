import React, { useState, useEffect } from "react";
import { LoadingSpinner } from "./ui/loading-spinner";

interface PageTransitionProps {
  children: React.ReactNode;
  location?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  location,
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Start loading when the location changes
    setIsLoading(true);

    // Simulate page loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Adjust time as needed

    return () => {
      clearTimeout(timer);
    };
  }, [location]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner size="xl" />
          <p className="text-foreground/70 animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PageTransition;
