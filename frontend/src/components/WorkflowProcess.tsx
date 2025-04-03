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
    icon: <Upload className="h-6 w-6 text-purple-500" />,
    title: "Upload",
    description:
      "Publish directly to YouTube with optimized titles, descriptions, and tags.",
  },
];

const WorkflowProcess = () => {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
      className="section py-24 bg-gradient-to-b from-purple-50 to-white dark:from-purple-950/20 dark:to-background overflow-hidden relative"
      ref={sectionRef}
    >
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

      <div className="container-tight">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-400 dark:to-purple-600">
            The Effortless Process
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Create stunning YouTube Shorts in just a few clicks
          </p>
        </div>

        {/* Automated workflow animation */}
        <div className="relative mt-16">
          {/* Progress line */}
          <div className="absolute left-0 right-0 top-16 h-1 bg-gray-200 dark:bg-gray-800 rounded-full">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-500"
              style={{
                width: `${((activeStep + 1) / workflowSteps.length) * 100}%`,
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
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30"
                        : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
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
                    ${
                      index <= activeStep
                        ? "text-purple-700 dark:text-purple-400"
                        : "text-gray-600 dark:text-gray-400"
                    }
                  `}
                  >
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visualization of the process */}
        <div
          className={`
            mt-20 p-6 md:p-10 rounded-2xl shadow-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
            ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
            transition-all duration-1000 delay-500
          `}
        >
          <div className="aspect-video w-full relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
            {/* Animation showing automated workflow for each stage */}
            <div className="absolute inset-0 flex items-center justify-center">
              {activeStep === 0 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 animate-pulse">
                    <Lightbulb className="h-10 w-10 text-amber-500" />
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
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
                          className="inline-block mx-4 px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-sm"
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
                  <div className="mx-auto w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 animate-spin-slow">
                    <Settings className="h-10 w-10 text-blue-500" />
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    Customizing your video...
                  </p>

                  <div className="absolute bottom-10 left-0 w-full flex justify-center gap-4">
                    <div className="h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-blue-500 rounded-full"></div>
                    </div>
                    <div className="h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-blue-500 rounded-full"></div>
                    </div>
                    <div className="h-2 w-32 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full w-4/5 bg-blue-500 rounded-full"></div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <MonitorPlay className="h-10 w-10 text-green-500" />
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    Creating your Short...
                  </p>

                  <div className="absolute bottom-10 left-0 w-full">
                    <div className="h-3 w-3/4 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <p className="text-center text-xs mt-2 text-gray-500 dark:text-gray-400">
                      Processing: 67%
                    </p>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 animate-bounce">
                    <Upload className="h-10 w-10 text-purple-500" />
                  </div>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    Ready to upload!
                  </p>

                  <div className="absolute bottom-10 left-0 w-full flex items-center justify-center">
                    <div className="px-5 py-2 bg-purple-600 text-white rounded-lg font-medium animate-pulse">
                      Publish to YouTube
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkflowProcess;
