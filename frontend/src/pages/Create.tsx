import React from "react";
import CreateForm from "@/components/CreateForm";
import StickFigureAnimation from "@/components/StickFigureAnimation";

const Create = () => {
  return (
    <>
      {/* Single subtle stick figure animation */}
      <div className="fixed bottom-10 left-10 z-10 hidden md:block opacity-60">
        <StickFigureAnimation type="dance" delay={500} height={70} />
      </div>

      <div className="relative pt-16 md:pt-24 pb-16 md:pb-24">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="text-left md:text-center mb-12 md:mb-16">
            <h1 className="text-4xl md:text-5xl font-semibold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Create a New Short
            </h1>
            <p className="text-foreground/70 text-lg max-w-2xl mx-auto">
              Follow the simple steps below to generate your high-quality YouTube Short.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <CreateForm />
          </div>
        </div>
      </div>
    </>
  );
};

export default Create;
