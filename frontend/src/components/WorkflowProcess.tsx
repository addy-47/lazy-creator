import { useState, useEffect, useRef } from "react";
import { Lightbulb, Settings, MonitorPlay, Upload } from "lucide-react";
import StickFigureAnimation from "./StickFigureAnimation";

const workflowSteps = [
  {
    icon: <Lightbulb className="h-6 w-6 text-amber-500" />,
    title: "Generate Idea",
    description:
      "Choose a topic or use our AI to generate a compelling idea for your YouTube Short.",
  },
  {
    icon: <Settings className="h-6 w-6 text-blue-500" />,
    title: "Customize",
    description:
      "Adjust the script, background, duration, and other settings to match your vision.",
  },
  {
    icon: <MonitorPlay className="h-6 w-6 text-green-500" />,
    title: "Create",
    description:
      "Our AI generates your video automatically while you sit back and relax.",
  },
  {
    icon: <Upload className="h-6 w-6 text-[#E0115F]" />,
    title: "Upload",
    description:
      "Publish directly to YouTube with optimized titles, descriptions, and tags.",
  },
];

const WorkflowProcess = () => {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Track mouse position for interactive elements
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX / window.innerWidth - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % workflowSteps.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section
      className="section py-24 bg-[#0A0A0A] overflow-hidden relative"
      ref={sectionRef}
    >
      {/* Dynamic shadow overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-20"
          style={{
            background: `radial-gradient(circle at ${
              50 + mousePosition.x * 30
            }% ${
              50 + mousePosition.y * 30
            }%, rgba(224,17,95,0.3) 0%, rgba(128,0,0,0.2) 20%, transparent 60%)`,
          }}
        ></div>
      </div>

      {/* Stick figure animations */}
      <div className="absolute -top-10 right-10 hidden lg:block">
        <StickFigureAnimation type="sleep" delay={400} height={90} />
      </div>

      <div className="absolute bottom-40 left-10 hidden lg:block">
        <StickFigureAnimation type="wave" delay={800} height={90} />
      </div>

      <div className="absolute top-1/2 right-10 hidden lg:block">
        <StickFigureAnimation type="dance" delay={1200} height={90} />
      </div>

      <div className="container-tight relative z-10">
        <div className="max-w-3xl mb-16 text-left">
          <h2 className="font-semibold mb-4 text-4xl text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
            Sophisticated Automation Process
          </h2>
          <p className="text-lg text-gray-300">
            Our enterprise-grade workflow delivers professional results with
            minimal effort
          </p>
        </div>

        {/* Automated workflow animation */}
        <div className="relative mt-16">
          {/* Progress line with enhanced styling */}
          <div className="absolute left-0 right-0 top-16 h-1 bg-[#0A0A0A] rounded-full border border-[#722F37]/30">
            <div
              className="h-full bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full transition-all duration-500"
              style={{
                width: `${((activeStep + 1) / workflowSteps.length) * 100}%`,
                boxShadow: "0 0 10px rgba(224,17,95,0.5)",
              }}
            ></div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            {workflowSteps.map((step, index) => (
              <div
                key={index}
                className={`
                  ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  }
                  transition-all duration-700 ease-out
                `}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                {/* Step circle */}
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6
                    transition-all duration-500
                    ${
                      index <= activeStep
                        ? "bg-gradient-to-r from-[#800000] to-[#E0115F] text-white shadow-lg shadow-[#E0115F]/30"
                        : "bg-[#0A0A0A] text-gray-500 border border-[#722F37]/30"
                    }
                  `}
                >
                  <div className={index === activeStep ? "animate-pulse" : ""}>
                    {step.icon}
                  </div>
                </div>

                {/* Step content */}
                <div className="text-center">
                  <h3
                    className={`
                    text-lg font-medium mb-2 transition-colors duration-500
                    ${index <= activeStep ? "text-[#E0115F]" : "text-gray-400"}
                  `}
                  >
                    {step.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced process visualization */}
        <div
          className={`
            mt-20 p-6 md:p-10 rounded-2xl shadow-xl bg-black/30 border border-[#722F37]/30 backdrop-blur-sm
            ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
            transition-all duration-1000 delay-500
          `}
        >
          <div className="aspect-video w-full relative overflow-hidden rounded-lg bg-[#0A0A0A] border border-[#722F37]/20">
            {/* Animation showing automated workflow for each stage */}
            <div className="absolute inset-0 flex items-center justify-center">
              {activeStep === 0 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 animate-pulse">
                    <Lightbulb className="h-10 w-10 text-amber-500" />
                  </div>
                  <p className="text-gray-200 font-medium">
                    Generating ideas...
                  </p>

                  <div className="absolute w-full top-10 left-0 opacity-20 overflow-hidden">
                    <div className="animate-infinite-scroll-x whitespace-nowrap">
                      {[
                        "Travel tips",
                        "AI news",
                        "Cooking tutorial",
                        "Tech review",
                        "Life hack",
                        "Fitness routine",
                      ].map((idea, i) => (
                        <span
                          key={i}
                          className="inline-block mx-4 px-3 py-1 rounded-full bg-[#722F37]/20 text-sm"
                        >
                          {idea}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 animate-pulse">
                    <Settings className="h-10 w-10 text-blue-500" />
                  </div>
                  <p className="text-gray-200 font-medium">
                    Customizing content...
                  </p>

                  {/* Slider and controls visualization */}
                  <div className="max-w-md mx-auto mt-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-24 text-right">
                        Background:
                      </span>
                      <div className="h-2 flex-1 bg-[#722F37]/20 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-24 text-right">
                        Duration:
                      </span>
                      <div className="h-2 flex-1 bg-[#722F37]/20 rounded-full overflow-hidden">
                        <div className="h-full w-1/2 bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full"></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-24 text-right">
                        Text style:
                      </span>
                      <div className="h-2 flex-1 bg-[#722F37]/20 rounded-full overflow-hidden">
                        <div className="h-full w-2/3 bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mb-4 animate-pulse">
                    <MonitorPlay className="h-10 w-10 text-green-500" />
                  </div>
                  <p className="text-gray-200 font-medium">
                    Creating your video...
                  </p>

                  {/* Progress bar */}
                  <div className="max-w-md mx-auto mt-6 px-4">
                    <div className="w-full h-3 bg-[#722F37]/20 rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full"></div>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        Processing frames
                      </span>
                      <span className="text-xs text-gray-400">
                        Rendering video
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-[#E0115F]/10 flex items-center justify-center mb-4 animate-pulse">
                    <Upload className="h-10 w-10 text-[#E0115F]" />
                  </div>
                  <p className="text-gray-200 font-medium">
                    Uploading to YouTube...
                  </p>

                  {/* Upload visualization */}
                  <div className="max-w-md mx-auto mt-6 px-4">
                    <div className="w-full p-4 rounded-lg border border-[#722F37]/30 bg-black/20">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded bg-[#800000]/20"></div>
                        <div className="flex-1">
                          <div className="h-2 w-3/4 bg-[#722F37]/20 rounded-full mb-2"></div>
                          <div className="h-2 w-1/2 bg-[#722F37]/20 rounded-full"></div>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-[#722F37]/20 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full"></div>
                      </div>
                      <div className="flex justify-end mt-2">
                        <span className="text-xs text-[#E0115F]">75%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#E0115F]/5 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#800000]/5 to-transparent"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowProcess;
