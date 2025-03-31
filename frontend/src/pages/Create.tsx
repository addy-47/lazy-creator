import { useContext } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CreateForm from "@/components/CreateForm";
import StickFigureAnimation from "@/components/StickFigureAnimation";
import { AuthContext } from "../App";

const Create = () => {
  const { username } = useContext(AuthContext);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Enhanced background with gradient and pattern */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>

      <Navbar username={username} />
      <main className="flex-grow pt-32 pb-20 px-4">
        <div className="container-tight mb-12 text-center relative">
          <h1 className="text-3xl font-semibold md:text-4xl mb-4">
            Create Your YouTube Short
          </h1>
          <p className="text-foreground/70 max-w-2xl mx-auto">
            Fill out the options below to generate your custom YouTube Short.
            Choose a prompt, set the duration, and select your background.
          </p>

          {/* Single stick figure animation in a more subtle position */}
          <div className="absolute -top-8 right-1/4 hidden md:block">
            <StickFigureAnimation type="dance" delay={400} height={60} />
          </div>
        </div>

        <div className="relative">
          <CreateForm />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Create;
