import React, { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface MainLayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

/**
 * MainLayout provides a consistent structure and spacing for the application.
 * It ensures the fixed Navbar doesn't overlap with content and provides 
 * global padding-top.
 */
const MainLayout = React.memo(({ children, showFooter = true }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col pt-20 transition-all duration-300">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
});

MainLayout.displayName = "MainLayout";

export default MainLayout;
