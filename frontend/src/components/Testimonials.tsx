import { useRef, useEffect, useState } from "react";
import { Star, Quote } from "lucide-react";
import StickFigureAnimation from "./StickFigureAnimation";

const testimonials = [
  {
    name: "Alex Morgan",
    role: "Content Creator",
    avatar: "https://i.pravatar.cc/150?img=32",
    content:
      "LazyCreator has completely transformed my content workflow. I can now create multiple Shorts in the time it used to take me to make just one. The automation is mind-blowing!",
    rating: 5,
  },
  {
    name: "Jamie Chen",
    role: "Tech Reviewer",
    avatar: "https://i.pravatar.cc/150?img=29",
    content:
      "As someone who needs to create lots of quick tech reviews, this tool is a game-changer. The AI understands exactly what I need and the upload integration is seamless.",
    rating: 5,
  },
  {
    name: "Taylor Wilson",
    role: "Travel Vlogger",
    avatar: "https://i.pravatar.cc/150?img=27",
    content:
      "I was skeptical about AI-generated content, but LazyCreator produces such high-quality Shorts that my engagement has actually increased! Worth every penny.",
    rating: 5,
  },
  {
    name: "Sam Rodriguez",
    role: "Fitness Instructor",
    avatar: "https://i.pravatar.cc/150?img=57",
    content:
      "This tool lets me focus on creating workout routines while it handles the video production. My YouTube channel has grown 300% since I started using LazyCreator.",
    rating: 4,
  },
];

const Testimonials = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const testimonialsRef = useRef<HTMLDivElement>(null);
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

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Animation on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (testimonialsRef.current) {
      observer.observe(testimonialsRef.current);
    }

    return () => {
      if (testimonialsRef.current) {
        observer.unobserve(testimonialsRef.current);
      }
    };
  }, []);

  return (
    <section
      className="section py-24 bg-[#0A0A0A] overflow-hidden relative"
      ref={testimonialsRef}
    >
      {/* Dynamic background effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-10"
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
      <div className="absolute top-24 right-12 hidden lg:block">
        <StickFigureAnimation type="wave" delay={400} height={90} />
      </div>

      <div className="absolute bottom-24 left-12 hidden lg:block">
        <StickFigureAnimation type="stretch" delay={600} height={90} />
      </div>

      <div className="absolute top-1/2 -translate-y-1/2 right-1/4 hidden lg:block">
        <StickFigureAnimation type="dance" delay={800} height={90} />
      </div>

      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#E0115F]/10 blur-3xl"></div>
        <div className="absolute top-1/2 -left-24 w-48 h-48 rounded-full bg-[#800000]/10 blur-3xl"></div>
      </div>

      <div className="container-tight relative z-10">
        <div className="max-w-3xl mb-16 text-left">
          <h2 className="font-semibold mb-4 text-4xl text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
            Client Testimonials
          </h2>
          <p className="text-lg text-gray-300">
            See how our platform has empowered content creators across diverse
            industries
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="relative max-w-4xl mx-auto">
          {/* Large quote icon */}
          <div className="absolute -top-10 -left-10 text-[#800000]/20 transform -rotate-6">
            <Quote size={100} strokeWidth={0.5} />
          </div>

          {/* Testimonial slider */}
          <div
            className={`
              relative min-h-[300px]
              ${isVisible ? "opacity-100" : "opacity-0"}
              transition-opacity duration-1000
            `}
          >
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`
                  absolute inset-0 flex flex-col md:flex-row items-center gap-4 md:gap-8 p-4 md:p-10
                  rounded-2xl border border-[#722F37]/30
                  bg-black/40 backdrop-blur-sm shadow-xl
                  transition-all duration-700 ease-out
                  ${
                    index === activeIndex
                      ? "opacity-100 translate-y-0 z-10"
                      : "opacity-0 translate-y-8 -z-10"
                  }
                `}
                style={{
                  transform:
                    index === activeIndex
                      ? `perspective(1000px) rotateY(${
                          mousePosition.x * 2
                        }deg) rotateX(${-mousePosition.y * 2}deg)`
                      : "translateY(2rem)",
                  transformStyle: "preserve-3d",
                  transition: "all 0.7s ease-out",
                }}
              >
                {/* Decorative gradient elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#E0115F]/5 to-transparent rounded-bl-full"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-[#800000]/5 to-transparent rounded-tr-full"></div>

                {/* Avatar section */}
                <div className="flex-shrink-0 w-20 h-20 md:w-32 md:h-32">
                  <div className="relative">
                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#722F37]/30 shadow-md">
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Animated pulse effect */}
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#800000] to-[#E0115F] opacity-0 group-hover:opacity-30 blur animate-pulse"></div>
                  </div>
                </div>

                {/* Content section */}
                <div className="flex-grow text-center md:text-left relative z-10">
                  {/* Rating stars */}
                  <div className="flex justify-center md:justify-start gap-1 mb-2 md:mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={
                          i < testimonial.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-600"
                        }
                      />
                    ))}
                  </div>

                  {/* Testimonial content */}
                  <p className="text-gray-300 text-base md:text-lg italic mb-3 md:mb-4">
                    "{testimonial.content}"
                  </p>

                  {/* Author info */}
                  <div>
                    <h4 className="font-semibold text-white">
                      {testimonial.name}
                    </h4>
                    <p className="text-[#E0115F] text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Custom navigation controls */}
          <div className="flex justify-center gap-4 mt-12">
            <button
              onClick={() =>
                setActiveIndex((prev) =>
                  prev === 0 ? testimonials.length - 1 : prev - 1
                )
              }
              className="w-10 h-10 rounded-full flex items-center justify-center border border-[#722F37]/30 hover:border-[#E0115F]/50 text-white hover:bg-[#E0115F]/10 transition-all duration-300"
            >
              <span className="sr-only">Previous</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            {/* Indicator dots */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={`
                    w-2.5 h-2.5 rounded-full transition-all duration-300
                    ${
                      index === activeIndex
                        ? "bg-gradient-to-r from-[#800000] to-[#E0115F] w-8"
                        : "bg-[#722F37]/50 hover:bg-[#E0115F]/30"
                    }
                  `}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() =>
                setActiveIndex((prev) =>
                  prev === testimonials.length - 1 ? 0 : prev + 1
                )
              }
              className="w-10 h-10 rounded-full flex items-center justify-center border border-[#722F37]/30 hover:border-[#E0115F]/50 text-white hover:bg-[#E0115F]/10 transition-all duration-300"
            >
              <span className="sr-only">Next</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
