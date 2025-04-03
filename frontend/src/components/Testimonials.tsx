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
      className="section py-24 bg-white dark:bg-black overflow-hidden relative"
      ref={testimonialsRef}
    >
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
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-purple-200/30 dark:bg-purple-900/20 blur-3xl"></div>
        <div className="absolute top-1/2 -left-24 w-48 h-48 rounded-full bg-purple-200/30 dark:bg-purple-900/20 blur-3xl"></div>
      </div>

      <div className="container-tight relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-400 dark:to-purple-600">
            What Our Users Say
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Join thousands of content creators who are saving time with
            LazyCreator
          </p>
        </div>

        {/* Testimonial cards */}
        <div className="relative max-w-4xl mx-auto">
          {/* Large quote icon */}
          <div className="absolute -top-10 -left-10 text-purple-200 dark:text-purple-900/30 transform -rotate-6">
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
                  absolute inset-0 flex flex-col md:flex-row items-center gap-8 p-6 md:p-10
                  rounded-2xl border border-purple-100 dark:border-purple-900/30
                  bg-white dark:bg-gray-900 shadow-xl shadow-purple-900/5
                  transition-all duration-700 ease-out
                  ${
                    index === activeIndex
                      ? "opacity-100 translate-y-0 z-10"
                      : "opacity-0 translate-y-8 -z-10"
                  }
                `}
              >
                {/* Avatar section */}
                <div className="flex-shrink-0 w-24 h-24 md:w-32 md:h-32">
                  <div className="relative">
                    <div className="w-full h-full rounded-full overflow-hidden border-4 border-purple-100 dark:border-purple-900/50 shadow-md">
                      <img
                        src={testimonial.avatar}
                        alt={testimonial.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Animated pulse effect */}
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 opacity-0 group-hover:opacity-30 blur animate-pulse"></div>
                  </div>
                </div>

                {/* Content section */}
                <div className="flex-grow text-center md:text-left">
                  {/* Rating stars */}
                  <div className="flex justify-center md:justify-start gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={
                          i < testimonial.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }
                      />
                    ))}
                  </div>

                  {/* Testimonial content with animated counter */}
                  <p className="text-gray-700 dark:text-gray-300 text-lg italic mb-4">
                    "{testimonial.content}"
                  </p>

                  {/* Author info */}
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {testimonial.name}
                    </h4>
                    <p className="text-purple-600 dark:text-purple-400 text-sm">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Indicator dots */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`
                  w-3 h-3 rounded-full transition-all duration-300
                  ${
                    index === activeIndex
                      ? "bg-purple-600 scale-125"
                      : "bg-purple-200 dark:bg-purple-900/30"
                  }
                `}
                aria-label={`View testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
