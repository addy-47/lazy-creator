
import { useState, useEffect } from "react";
import Logo from "./Logo";

interface GeneratingAnimationProps {
  duration: number;
  onComplete: () => void;
}

const GeneratingAnimation = ({ duration, onComplete }: GeneratingAnimationProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [dots, setDots] = useState("");
  const [currentStep, setCurrentStep] = useState(0);

  const generationSteps = [
    { name: "Analyzing prompt", delay: 0 },
    { name: "Generating content", delay: 2 },
    { name: "Optimizing script", delay: 5 },
    { name: "Adding background", delay: 10 },
    { name: "Applying effects", delay: 15 },
    { name: "Finalizing", delay: 20 },
  ];

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((prevDots) => {
        if (prevDots.length >= 3) return "";
        return prevDots + ".";
      });
    }, 500);

    return () => clearInterval(dotTimer);
  }, []);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      const nextPossibleStep = generationSteps.findIndex(
        step => duration - timeLeft >= step.delay && step.delay > (generationSteps[currentStep]?.delay || -1)
      );
      
      if (nextPossibleStep !== -1 && nextPossibleStep > currentStep) {
        setCurrentStep(nextPossibleStep);
      }
    }, 1000);

    return () => clearInterval(stepTimer);
  }, [timeLeft, currentStep, duration]);

  const progressPercentage = ((duration - timeLeft) / duration) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="glass-card p-8 animate-scale-in">
          <div className="text-center space-y-8">
            <div className="relative w-40 h-40 mx-auto">
              {/* Outer circle */}
              <div className="absolute inset-0 rounded-full border-4 border-secondary"></div>
              
              {/* Progress circle */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="text-primary transform -rotate-90 origin-center transition-all duration-1000"
                  strokeDasharray={`${progressPercentage * 2.89}, 289`}
                />
              </svg>
              
              {/* Spinning logo */}
              <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
                <div className="bg-background rounded-full p-2">
                  <Logo size="default" />
                </div>
              </div>
              
              {/* Time left */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center bg-background/80 rounded-full w-16 h-16 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-3xl font-semibold">{timeLeft}</span>
                  <span className="text-lg">s</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-semibold">
                {generationSteps[currentStep]?.name}{dots}
              </h3>
              <p className="text-foreground/70">
                Creating your YouTube Short. This process takes a moment.
              </p>
            </div>

            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {generationSteps.map((step, index) => (
                <div 
                  key={index}
                  className={`p-2 rounded-md border transition-all ${
                    index <= currentStep 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-border text-foreground/60"
                  }`}
                >
                  {index === currentStep && (
                    <div className="flex items-center space-x-1">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      <span>{step.name}</span>
                    </div>
                  )}
                  {index !== currentStep && step.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneratingAnimation;
