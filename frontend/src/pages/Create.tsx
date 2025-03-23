
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CreateForm from "@/components/CreateForm";
import StickFigureAnimation from "@/components/StickFigureAnimation";

const Create = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Enhanced background with gradient and pattern */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background/90 to-background">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        </div>
      </div>
      
      <Navbar />
      <main className="flex-grow pt-32 pb-20 px-4">
        <div className="container-tight mb-12 text-center relative">
          <h1 className="text-3xl font-semibold md:text-4xl mb-4">Create Your YouTube Short</h1>
          <p className="text-foreground/70 max-w-2xl mx-auto">
            Fill out the options below to generate your custom YouTube Short. 
            Choose a prompt, set the duration, and select your background.
          </p>
          
          {/* Add stick figure animations */}
          <div className="absolute -top-8 right-0 hidden md:block">
            <StickFigureAnimation type="dance" delay={400} height={70} />
          </div>
          
          <div className="absolute -top-8 left-0 hidden md:block">
            <StickFigureAnimation type="stretch" delay={600} height={70} />
          </div>
        </div>
        
        <div className="relative">
          <CreateForm />
          
          {/* Add more stick figure animations */}
          <div className="absolute bottom-10 -right-10 hidden lg:block">
            <StickFigureAnimation type="sleep" delay={800} height={70} />
          </div>
          
          <div className="absolute bottom-10 -left-10 hidden lg:block">
            <StickFigureAnimation type="peek" delay={1000} height={70} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Create;
