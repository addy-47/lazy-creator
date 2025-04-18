import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CreateForm from "@/components/CreateForm";
import { useAuth } from "@/contexts/AuthContext";

const Create = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-background">
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>

      <Navbar />

      <main className="flex-grow relative pt-24 md:pt-32">
        <div className="container max-w-5xl mx-auto px-4 md:px-6 relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Create a Short Video
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Turn your script into a professional short-form video in minutes.
            </p>
          </div>

          <CreateForm />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Create;
