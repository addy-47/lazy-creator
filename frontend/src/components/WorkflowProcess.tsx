import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Lightbulb, Settings, MonitorPlay, Upload } from "lucide-react";
import {
  throttle,
  rafScroll,
  addPassiveEventListener,
  debounce,
  isInViewport,
} from "@/utils/scroll";

// Pre-define the step data outside the component to avoid recreating on each render
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
  // Component re-enabled for testing
  // return null;

  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseMoveListenerRef = useRef<(() => void) | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const gradientRef = useRef<HTMLDivElement>(null);
  const gradientStyleRef = useRef<string>(
    `radial-gradient(circle at 50% 50%, rgba(224,17,95,0.3) 0%, rgba(128,0,0,0.2) 20%, transparent 60%)`
  );
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInView = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Simplified scroll detection - only detect start and end
  useEffect(() => {
    let scrollTimer: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      isScrolling.current = true;

      // Clear previous timeout
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }

      // Set end detection with a reasonable delay
      scrollTimer = setTimeout(() => {
        isScrolling.current = false;
      }, 200);
    };

    // Use passive event listener to improve performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, []);

  // Simplified mouse move effect with very high throttle
  useEffect(() => {
    // Skip effect on low-end devices
    if (
      typeof window === "undefined" ||
      window.navigator.hardwareConcurrency < 4
    )
      return;

    // Set initial gradient
    if (gradientRef.current) {
      gradientRef.current.style.background = gradientStyleRef.current;
    }

    // OPTIMIZATION: Disable mouse move effect completely for better performance
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // Step rotation interval with condition to pause during scrolling
  useEffect(() => {
    if (!isVisible) return;

    // Use a longer interval
    const interval = setInterval(() => {
      // Skip during scrolling or when not visible
      if (isScrolling.current || !isInView.current) return;

      setActiveStep((prev) => (prev + 1) % workflowSteps.length);
    }, 5000);

    intervalRef.current = interval;

    return () => {
      clearInterval(interval);
      intervalRef.current = null;
    };
  }, [isVisible]);

  // Handle section visibility with IntersectionObserver
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      // Update in-view status
      isInView.current = entry.isIntersecting;

      // Only process visibility change when entering viewport
      if (entry.isIntersecting && !isVisible) {
        // Set visible after a small delay
        const timer = setTimeout(() => {
          setIsVisible(true);
        }, 100);

        animationTimeoutRef.current = timer;
      }
    },
    [isVisible]
  );

  // Setup intersection observer
  useEffect(() => {
    if (!sectionRef.current) return;

    const options = {
      threshold: 0.1,
      rootMargin: "200px 0px",
    };

    observerRef.current = new IntersectionObserver(handleIntersection, options);
    observerRef.current.observe(sectionRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [handleIntersection]);

  // Pre-compute all step classes
  const stepVisibilityClasses = useMemo(
    () =>
      workflowSteps.map(() =>
        isVisible
          ? "opacity-100 translate-y-0 transition-opacity duration-500 ease-out"
          : "opacity-0 translate-y-8"
      ),
    [isVisible]
  );

  const stepCircleClasses = useMemo(
    () =>
      workflowSteps.map((_, index) => {
        const baseClasses =
          "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6";

        return index <= activeStep
          ? `${baseClasses} bg-gradient-to-r from-[#800000] to-[#E0115F] text-white shadow-lg shadow-[#E0115F]/30 transition-colors duration-300`
          : `${baseClasses} bg-[#0A0A0A] dark:bg-[#0A0A0A] light:bg-white text-gray-500 border border-[#722F37]/30 dark:border-[#722F37]/30 light:border-gray-300 transition-colors duration-300`;
      }),
    [activeStep]
  );

  const stepTitleClasses = useMemo(
    () =>
      workflowSteps.map((_, index) => {
        const baseClasses =
          "text-lg font-medium mb-2 transition-colors duration-300";

        return index <= activeStep
          ? `${baseClasses} text-[#E0115F]`
          : `${baseClasses} text-gray-400 dark:text-gray-400 light:text-gray-600`;
      }),
    [activeStep]
  );

  // Pre-calculate progress width
  const progressWidth = useMemo(
    () => `${((activeStep + 1) / workflowSteps.length) * 100}%`,
    [activeStep]
  );

  return (
    <section
      className="section py-24 dark:bg-[#0A0A0A] light:bg-gray-100 overflow-hidden relative"
      ref={sectionRef}
      style={{
        contain: "content",
        contentVisibility: isVisible ? "visible" : "auto",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          ref={gradientRef}
          className="absolute top-0 left-0 w-full h-full opacity-20"
          style={{
            background: gradientStyleRef.current,
            willChange: "background",
            transform: "translateZ(0)",
            contain: "paint",
          }}
        ></div>
      </div>

      <div className="container-tight relative z-10">
        <div className="max-w-3xl mb-16 text-left">
          <h2 className="font-semibold mb-4 text-4xl text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
            Sophisticated Automation Process
          </h2>
          <p className="text-lg text-black-300 dark:text-gray-300 light:text-gray-700">
            Our enterprise-grade workflow delivers professional results with
            minimal effort
          </p>
        </div>

        <div className="relative mt-16">
          <div className="absolute left-0 right-0 top-16 h-1 bg-[#0A0A0A] dark:bg-[#0A0A0A] light:bg-gray-200 rounded-full border border-[#722F37]/30 dark:border-[#722F37]/30 light:border-gray-300">
            <div
              className="h-full bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-full"
              style={{
                width: progressWidth,
                boxShadow: "0 0 10px rgba(224,17,95,0.5)",
                transition: "width 0.3s ease-out",
                contain: "strict",
              }}
            ></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
            {workflowSteps.map((step, index) => (
              <div
                key={index}
                className={stepVisibilityClasses[index]}
                style={{
                  transitionDelay: isVisible
                    ? `${Math.min(index * 30, 90)}ms`
                    : "0ms",
                }}
              >
                <div className={stepCircleClasses[index]}>
                  <div className={index === activeStep ? "animate-pulse" : ""}>
                    {step.icon}
                  </div>
                </div>

                <div className="text-center">
                  <h3 className={stepTitleClasses[index]}>{step.title}</h3>
                  <p className="text-gray-400 dark:text-gray-400 light:text-gray-600 text-sm">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`
            mt-20 p-6 md:p-10 rounded-2xl shadow-xl bg-black/30 dark:bg-black/30 light:bg-white/90 border border-[#722F37]/30 dark:border-[#722F37]/30 light:border-gray-200 backdrop-blur-sm
            ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
            transition-opacity duration-700 delay-300
          `}
          style={{
            contain: "content",
            transform: "translateZ(0)",
            willChange: "auto",
          }}
        >
          <div
            className="aspect-video w-full relative overflow-hidden rounded-lg bg-[#faf9f9] dark:bg-[#0A0A0A] light:bg-gray-100 border border-[#722F37]/20 dark:border-[#722F37]/20 light:border-gray-300"
            style={{ transform: "translateZ(0)" }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {activeStep === 0 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                    <Lightbulb className="h-10 w-10 text-amber-500" />
                  </div>
                  <p className="text-gray-200 dark:text-gray-200 light:text-gray-800 font-medium">
                    Generating ideas...
                  </p>
                </div>
              )}

              {activeStep === 1 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <Settings className="h-10 w-10 text-blue-500" />
                  </div>
                  <p className="dark:text-gray-200 light:text-gray-800 font-medium">
                    Customizing content...
                  </p>
                </div>
              )}

              {activeStep === 2 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                    <MonitorPlay className="h-10 w-10 text-green-500" />
                  </div>
                  <p className="dark:text-gray-200 light:text-gray-800 font-medium">
                    Creating video...
                  </p>
                </div>
              )}

              {activeStep === 3 && (
                <div className="text-center">
                  <div className="mx-auto w-24 h-24 rounded-full bg-[#E0115F]/10 flex items-center justify-center mb-4">
                    <Upload className="h-10 w-10 text-[#E0115F]" />
                  </div>
                  <p className="dark:text-gray-200 light:text-gray-800 font-medium">
                    Uploading to YouTube...
                  </p>
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
