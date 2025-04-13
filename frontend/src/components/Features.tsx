import {
  Sparkles,
  Sliders,
  Clock,
  Image,
  Upload,
  ImagePlus,
} from "lucide-react";
import { useRef, useEffect } from "react";
import StickFigureAnimation from "./StickFigureAnimation";

const features = [
  {
    icon: <Sparkles className="h-6 w-6 text-purple-500" />,
    title: "AI-Powered Prompts",
    description:
      "Choose from curated prompts or create your own to generate engaging content for your YouTube Shorts.",
    hoverContent: (
      <div className="space-y-2 text-sm">
        <p>→ Select from trending topics</p>
        <p>→ Generate custom prompts</p>
        <p>→ Save favorites for reuse</p>
      </div>
    ),
  },
  {
    icon: <Sliders className="h-6 w-6 text-purple-500" />,
    title: "Customizable Options",
    description:
      "Adjust every aspect of your Short to match your style and preferences with intuitive controls.",
    hoverContent: (
      <div className="space-y-2 text-sm">
        <p>→ Style presets for quick editing</p>
        <p>→ Precise control over visuals</p>
        <p>→ Save custom templates</p>
      </div>
    ),
  },
  {
    icon: <Clock className="h-6 w-6 text-purple-500" />,
    title: "Perfect Duration",
    description:
      "Set the exact length for your Shorts with our smooth duration slider for optimal viewer engagement.",
    hoverContent: (
      <div className="space-y-2 text-sm">
        <p>→ YouTube-optimized time presets</p>
        <p>→ Smart content pacing</p>
        <p>→ Automated content trimming</p>
      </div>
    ),
  },
  {
    icon: <Image className="h-6 w-6 text-purple-500" />,
    title: "Background Selection",
    description:
      "Choose from our library of backgrounds or upload your own images and videos for a personalized touch.",
    hoverContent: (
      <div className="space-y-2 text-sm">
        <p>→ Curated background library</p>
        <p>→ AI-enhanced custom uploads</p>
        <p>→ Auto-matching colors & themes</p>
      </div>
    ),
  },
  {
    icon: <Upload className="h-6 w-6 text-purple-500" />,
    title: "Direct Upload",
    description:
      "Publish your finished Shorts directly to YouTube or download them for later use.",
    hoverContent: (
      <div className="space-y-2 text-sm">
        <p>→ One-click YouTube publishing</p>
        <p>→ Schedule for optimal posting times</p>
        <p>→ Auto-generate descriptions & tags</p>
      </div>
    ),
  },
  {
    icon: <ImagePlus className="h-6 w-6 text-purple-500" />,
    title: "Thumbnail Creation",
    description:
      "Generate eye-catching thumbnails automatically from your Shorts with AI-powered optimization.",
    hoverContent: (
      <div className="space-y-2 text-sm">
        <p>→ AI-generated thumbnails</p>
        <p>→ Custom branding options</p>
        <p>→ Click-through optimization</p>
      </div>
    ),
  },
];

const Features = () => {
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const cards = featuresRef.current?.querySelectorAll(".feature-card");
          cards?.forEach((card, index) => {
            setTimeout(() => {
              card.classList.add("show");
            }, 100 * index);
          });
        }
      });
    }, options);

    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section
      id="features"
      className="section py-24 bg-gradient-to-b from-background to-purple-50 dark:to-purple-950/20 relative"
    >
      {/* Stick figure animations */}
      <div className="absolute top-20 right-10 hidden lg:block">
        <StickFigureAnimation type="stretch" delay={300} height={90} />
      </div>

      <div className="absolute bottom-20 left-10 hidden lg:block">
        <StickFigureAnimation type="jump" delay={600} height={90} />
      </div>

      <div className="absolute top-1/3 left-1/2 hidden lg:block">
        <StickFigureAnimation type="peek" delay={900} height={90} />
      </div>

      <div className="container-wide" ref={featuresRef}>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-400 dark:to-purple-600">
            Laziness Elevated to an Art Form
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Everything you need to create professional YouTube Shorts without
            breaking a sweat
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card relative group opacity-0 translate-y-4 transition-all duration-700"
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              {/* Card background with gradient border */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-purple-400 dark:from-purple-700 dark:to-purple-500 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>

              {/* Main card content */}
              <div className="relative bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-6 h-full z-10 overflow-hidden transition-all duration-300 group-hover:translate-y-[-4px]">
                {/* Card content container */}
                <div className="relative z-10 h-full flex flex-col">
                  {/* Icon and title in a row */}
                  <div className="flex items-center mb-3">
                    <h3 className="text-xl font-medium mr-3 text-gray-900 dark:text-white">
                      {feature.title}
                    </h3>
                    <div className="rounded-full w-10 h-10 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:shadow-purple-500/20 flex-shrink-0">
                      {feature.icon}
                    </div>
                  </div>

                  <p className="text-gray-600 dark:text-gray-300 group-hover:opacity-0 transition-opacity duration-300">
                    {feature.description}
                  </p>

                  {/* Hover content that appears */}
                  <div className="absolute inset-0 pt-[4rem] px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col">
                    {feature.hoverContent}
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-purple-200/40 to-transparent dark:from-purple-900/20 rounded-tl-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>
        {`
        .feature-card.show {
          opacity: 1;
          transform: translateY(0);
        }
        `}
      </style>
    </section>
  );
};

export default Features;
