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
      className="font-bold text-3xl md:text-4xl lg:text-5xl text-gray-900 dark:text-white"
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
    icon: <Award className="h-10 w-10 text-purple-500" />,
    value: 98,
    suffix: "%",
    label: "Satisfaction Rate",
    description: "Users who would recommend LazyCreator",
  },
];

const Statistics = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

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
    <section
      className="section py-24 bg-gradient-to-b from-white to-purple-50 dark:from-black dark:to-purple-950/20 relative"
      ref={sectionRef}
    >
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

      <div className="container-wide">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-400 dark:to-purple-600">
            LazyCreator by the Numbers
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            See the impact our platform is making for content creators worldwide
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`
                p-6 rounded-2xl transition-all duration-700 ease-out
                ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-8"
                }
                bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl
                border border-purple-100 dark:border-purple-900/30
                hover:border-purple-300 dark:hover:border-purple-700
                group
              `}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* Icon with animated background */}
              <div className="rounded-full w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-800 mb-6 group-hover:scale-110 transition-transform duration-300 relative">
                {stat.icon}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
              </div>

              {/* Animated counter */}
              <Counter
                end={stat.value}
                duration={2000}
                suffix={stat.suffix}
                delay={index * 200}
              />

              <h3 className="text-xl font-semibold mt-2 mb-1 text-gray-900 dark:text-white">
                {stat.label}
              </h3>

              <p className="text-gray-600 dark:text-gray-400">
                {stat.description}
              </p>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div
          className={`
            mt-20 p-10 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-800 text-white text-center
            ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
            transition-all duration-1000 delay-500 shadow-xl shadow-purple-500/20
          `}
        >
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to join them?
          </h3>
          <p className="text-lg text-purple-100 mb-8 max-w-2xl mx-auto">
            Start creating effortless YouTube Shorts today and see the results
            for yourself.
          </p>
          <a
            href="/create"
            className="inline-flex items-center px-8 py-3 rounded-full bg-white text-purple-700 font-semibold hover:bg-purple-50 transition-colors duration-300 group"
          >
            Get Started
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-2 transform transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};

export default Statistics;
