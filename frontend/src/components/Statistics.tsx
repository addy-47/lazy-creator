import { useRef, useEffect, useState } from "react";
import { Clock, Users, Video, Award } from "lucide-react";
import StickFigureAnimation from "./StickFigureAnimation";

interface CounterProps {
  end: number;
  duration: number;
  prefix?: string;
  suffix?: string;
  delay?: number;
}

const Counter = ({
  end,
  duration,
  prefix = "",
  suffix = "",
  delay = 0,
}: CounterProps) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => {
      if (counterRef.current) {
        observer.unobserve(counterRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number | null = null;
    let animationFrame: number;

    // Add delay before starting animation
    const timer = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = (timestamp - startTime) / duration;

        if (progress < 1) {
          setCount(Math.floor(end * progress));
          animationFrame = requestAnimationFrame(animate);
        } else {
          setCount(end);
        }
      };

      animationFrame = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animationFrame);
    };
  }, [isVisible, end, duration, delay]);

  return (
    <div
      ref={counterRef}
      className="font-bold text-3xl md:text-4xl lg:text-5xl text-white"
    >
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </div>
  );
};

const stats = [
  {
    icon: <Clock className="h-10 w-10 text-amber-500" />,
    value: 85,
    suffix: "%",
    label: "Time Saved",
    description: "Average time saved compared to traditional video editing",
  },
  {
    icon: <Users className="h-10 w-10 text-blue-500" />,
    value: 25000,
    suffix: "+",
    label: "Active Users",
    description: "Content creators using LazyCreator daily",
  },
  {
    icon: <Video className="h-10 w-10 text-green-500" />,
    value: 1000000,
    suffix: "+",
    label: "Videos Created",
    description: "YouTube Shorts generated through our platform",
  },
  {
    icon: <Award className="h-10 w-10 text-[#E0115F]" />,
    value: 98,
    suffix: "%",
    label: "Satisfaction Rate",
    description: "Users who would recommend LazyCreator",
  },
];

const Statistics = () => {
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
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
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
    <section className="section py-24 bg-[#0A0A0A] relative" ref={sectionRef}>
      {/* Dynamic background effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-15"
          style={{
            background: `radial-gradient(circle at ${
              50 + mousePosition.x * 30
            }% ${
              50 + mousePosition.y * 30
            }%, rgba(224,17,95,0.2) 0%, rgba(128,0,0,0.15) 30%, transparent 70%)`,
          }}
        ></div>
      </div>

      {/* Stick figure animations */}
      <div className="absolute top-20 right-16 hidden lg:block">
        <StickFigureAnimation type="peek" delay={300} height={90} />
      </div>

      <div className="absolute bottom-40 left-16 hidden lg:block">
        <StickFigureAnimation type="jump" delay={600} height={90} />
      </div>

      <div className="absolute bottom-80 right-1/4 hidden lg:block">
        <StickFigureAnimation type="spin" delay={900} height={90} />
      </div>

      <div className="container-wide relative z-10">
        <div className="max-w-3xl mb-16 text-left">
          <h2 className="font-semibold mb-4 text-4xl text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
            Performance Metrics
          </h2>
          <p className="text-lg text-gray-300">
            Quantifiable results that demonstrate our platform's
            industry-leading capabilities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`
                p-8 rounded-2xl transition-all duration-700 ease-out
                ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }
                bg-black/40 shadow-lg hover:shadow-xl backdrop-blur-sm
                border border-[#722F37]/30 hover:border-[#E0115F]/30
                group relative overflow-hidden
              `}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* Gradient decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#E0115F]/5 to-transparent opacity-30 group-hover:opacity-50 transition-opacity"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-[#800000]/5 to-transparent opacity-30 group-hover:opacity-50 transition-opacity"></div>

              {/* Content */}
              <div className="relative z-10">
                {/* Icon with animated background */}
                <div className="rounded-full w-16 h-16 flex items-center justify-center bg-black mb-6 group-hover:scale-110 transition-transform duration-300 relative border border-[#722F37]/30">
                  {stat.icon}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#800000]/20 to-[#E0115F]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                </div>

                {/* Animated counter */}
                <Counter
                  end={stat.value}
                  duration={2000}
                  suffix={stat.suffix}
                  delay={index * 200}
                />

                <h3 className="text-lg font-medium mt-2 mb-1 text-[#E0115F]">
                  {stat.label}
                </h3>
                <p className="text-gray-400 text-sm">{stat.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Performance dashboard visualization */}
        <div
          className={`
            mt-16 p-8 rounded-2xl border border-[#722F37]/30 bg-black/30 backdrop-blur-sm
            ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
            transition-all duration-1000 delay-800
          `}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-left">
              <h3 className="text-2xl font-medium mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#800000] to-[#E0115F]">
                Real-time Statistics
              </h3>
              <p className="text-gray-300 mb-6 max-w-lg">
                Our platform constantly monitors performance metrics to ensure
                you're getting the maximum return on your content investment.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-[#722F37]/30 rounded-lg p-4 bg-black/30">
                  <p className="text-sm text-gray-400 mb-1">
                    Average View Duration
                  </p>
                  <p className="text-xl font-medium text-[#E0115F]">+42%</p>
                </div>
                <div className="border border-[#722F37]/30 rounded-lg p-4 bg-black/30">
                  <p className="text-sm text-gray-400 mb-1">Engagement Rate</p>
                  <p className="text-xl font-medium text-[#E0115F]">+68%</p>
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/2 aspect-[4/3] bg-black/40 rounded-xl border border-[#722F37]/30 overflow-hidden relative">
              {/* Graph visualization */}
              <div className="absolute inset-0 p-4">
                <div className="h-full flex items-end">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="w-full h-0 bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm transition-all duration-1000"
                      style={{
                        height: isVisible
                          ? `${20 + Math.sin(i / 2) * 50}%`
                          : "0%",
                        transitionDelay: `${800 + i * 50}ms`,
                      }}
                    ></div>
                  ))}
                </div>
                <div className="absolute bottom-2 left-0 right-0 h-px bg-[#722F37]/30"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Statistics;
