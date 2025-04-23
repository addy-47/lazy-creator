import {
  Sparkles,
  Sliders,
  Clock,
  Image,
  Upload,
  ImagePlus,
  CheckCircle2,
  Cpu,
  BarChart2,
  Hourglass,
  Camera,
  PenTool,
  Zap,
  Video,
} from "lucide-react";
import { useRef, useEffect, useState } from "react";

const features = [
  {
    icon: <Sparkles className="h-6 w-6 text-[#E0115F]" />,
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
    icon: <Sliders className="h-6 w-6 text-[#E0115F]" />,
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
    icon: <Clock className="h-6 w-6 text-[#E0115F]" />,
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
    icon: <Image className="h-6 w-6 text-[#E0115F]" />,
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
    icon: <Upload className="h-6 w-6 text-[#E0115F]" />,
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
    icon: <ImagePlus className="h-6 w-6 text-[#E0115F]" />,
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
  const [activeFeature, setActiveFeature] = useState(-1);
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: "50px", // Larger margin to start loading earlier
      threshold: 0.1,
    };

    const observer = new IntersectionObserver((entries) => {
      // Use requestAnimationFrame to avoid blocking the main thread
      requestAnimationFrame(() => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards =
              featuresRef.current?.querySelectorAll(".feature-card");
            if (!cards) return;

            // Add show class to cards with staggered delay
            cards.forEach((card, index) => {
              const delay = 50 * index; // Reduced delay for better performance
              setTimeout(() => {
                card.classList.add("show");
              }, delay);
            });

            // Disconnect observer after animation to reduce overhead
            observer.disconnect();
          }
        });
      });
    }, options);

    if (featuresRef.current) {
      observer.observe(featuresRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const featuresList = [
    {
      icon: <Cpu className="h-6 w-6 text-[#E0115F]" />,
      title: "AI-Powered",
      description:
        "Our advanced AI handles the entire creation process from script generation to editing.",
    },
    {
      icon: <BarChart2 className="h-6 w-6 text-[#E0115F]" />,
      title: "Analytics",
      description: "Get detailed insights on how your shorts are performing.",
    },
    {
      icon: <Upload className="h-6 w-6 text-[#E0115F]" />,
      title: "Automated Upload",
      description:
        "Automatically upload to YouTube with optimized titles and descriptions.",
    },
    {
      icon: <Hourglass className="h-6 w-6 text-[#E0115F]" />,
      title: "Time-Saving",
      description: "Create weeks worth of content in just minutes.",
    },
    {
      icon: <Camera className="h-6 w-6 text-[#E0115F]" />,
      title: "AI Thumbnails",
      description: "Generate eye-catching thumbnails with our AI.",
    },
    {
      icon: <PenTool className="h-6 w-6 text-[#E0115F]" />,
      title: "Custom Style",
      description:
        "Tailor the look and feel of your shorts to match your brand.",
    },
    {
      icon: <Zap className="h-6 w-6 text-[#E0115F]" />,
      title: "Lightning Fast",
      description: "Get your shorts ready in minutes, not hours or days.",
    },
    {
      icon: <Video className="h-6 w-6 text-[#E0115F]" />,
      title: "High Quality",
      description: "Professional-grade shorts that stand out in the feed.",
    },
  ];

  return (
    <section
      id="features"
      className="section py-24 dark:bg-[#0A0A0A] light:bg-gray-50 relative"
    >
      <div className="container-wide relative z-10" ref={featuresRef}>
        <div className="max-w-3xl mb-16">
          <h2 className="font-semibold mb-4 text-4xl text-left text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
            Enterprise-Grade Automation
          </h2>
          <p className="text-lg dark:text-gray-300 light:text-gray-800 text-left">
            Our platform provides sophisticated tools that transform the way you
            create and distribute YouTube Shorts
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card relative group opacity-0 translate-y-4 transition-all duration-700"
              style={{ transitionDelay: `${index * 50}ms` }}
              onMouseEnter={() => setActiveFeature(index)}
              onMouseLeave={() => setActiveFeature(-1)}
            >
              {/* Card background with gradient border */}
              <div
                className={`absolute -inset-0.5 bg-gradient-to-r from-[#800000] to-[#E0115F] rounded-2xl opacity-0
                ${
                  activeFeature === index
                    ? "opacity-100"
                    : "group-hover:opacity-30"
                }
                transition-opacity duration-300 blur-sm`}
              ></div>

              {/* Main card content */}
              <div
                className="relative bg-[#fdfbfb] dark:bg-[#0A0A0A] light:bg-white shadow-xl rounded-2xl p-6 h-full z-10 overflow-hidden transition-all duration-300
                border border-[#722F37]/30 group-hover:translate-y-[-4px]"
              >
                {/* Card content container */}
                <div className="relative z-10 h-full flex flex-col">
                  {/* Icon and title in a row */}
                  <div className="flex items-center mb-3">
                    <h3 className="text-xl font-medium mr-3 dark:text-white light:text-gray-800">
                      {feature.title}
                    </h3>
                    <div
                      className="rounded-full w-10 h-10 flex items-center justify-center bg-[#800000]/10 transition-all duration-300
                      group-hover:scale-110 group-hover:shadow-md group-hover:shadow-[#E0115F]/20 flex-shrink-0"
                    >
                      {feature.icon}
                    </div>
                  </div>

                  <p className="dark:text-gray-300 light:text-gray-700 group-hover:opacity-0 transition-opacity duration-300">
                    {feature.description}
                  </p>

                  {/* Hover content that appears */}
                  <div className="absolute inset-0 pt-[4rem] px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col dark:text-gray-200 light:text-gray-700">
                    {feature.hoverContent}
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-[#E0115F]/10 to-transparent rounded-tl-full"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Table Section */}
        <div className="mt-32 mb-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold md:text-4xl dark:text-white light:text-gray-800">
              Why Choose{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
                LazyCreator
              </span>
            </h2>
            <p className="mt-4 text-lg max-w-xl mx-auto dark:text-gray-300 light:text-gray-700">
              See how we stack up against the competition
            </p>
          </div>

          <div className="overflow-x-auto glass-card-ruby p-6 shadow-lg dark:bg-black/50 light:bg-white/90 border dark:border-[#722F37]/30 light:border-[#722F37]/20 rounded-xl">
            <table className="w-full min-w-[750px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#722F37]/40 dark:border-[#722F37]/40 light:border-[#722F37]/30">
                  <th className="py-4 px-4 font-medium dark:text-gray-200 light:text-gray-800">
                    Feature
                  </th>
                  <th className="py-4 px-4 font-medium text-[#E0115F] text-center">
                    LazyCreator
                  </th>
                  <th className="py-4 px-4 font-medium dark:text-gray-200 light:text-gray-800 text-center">
                    InVideo
                  </th>
                  <th className="py-4 px-4 font-medium dark:text-gray-200 light:text-gray-800 text-center">
                    Pictory
                  </th>
                  <th className="py-4 px-4 font-medium dark:text-gray-200 light:text-gray-800 text-center">
                    Synthesia
                  </th>
                  <th className="py-4 px-4 font-medium dark:text-gray-200 light:text-gray-800 text-center">
                    Wisecut
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#722F37]/30 dark:border-[#722F37]/30 light:border-[#722F37]/20">
                  <td className="py-4 px-4 font-medium dark:text-gray-100 light:text-gray-800">
                    Content Creation
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CheckCircle2 className="h-5 w-5 text-[#E0115F] mx-auto" />
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Partial
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Partial
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Partial
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Partial
                  </td>
                </tr>
                <tr className="border-b border-[#722F37]/30 dark:border-[#722F37]/30 light:border-[#722F37]/20">
                  <td className="py-4 px-4 font-medium dark:text-gray-100 light:text-gray-800">
                    Media Flexibility
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CheckCircle2 className="h-5 w-5 text-[#E0115F] mx-auto" />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CheckCircle2 className="h-5 w-5 text-[#E0115F] mx-auto" />
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Limited
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CheckCircle2 className="h-5 w-5 text-[#E0115F] mx-auto" />
                  </td>
                </tr>
                <tr className="border-b border-[#722F37]/30 dark:border-[#722F37]/30 light:border-[#722F37]/20">
                  <td className="py-4 px-4 font-medium dark:text-gray-100 light:text-gray-800">
                    AI Thumbnail Generation
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CheckCircle2 className="h-5 w-5 text-[#E0115F] mx-auto" />
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Basic
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                </tr>
                <tr className="border-b border-[#722F37]/30 dark:border-[#722F37]/30 light:border-[#722F37]/20">
                  <td className="py-4 px-4 font-medium dark:text-gray-100 light:text-gray-800">
                    AI Metadata Generation
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CheckCircle2 className="h-5 w-5 text-[#E0115F] mx-auto" />
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Basic
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                </tr>
                <tr className="border-b border-[#722F37]/30 dark:border-[#722F37]/30 light:border-[#722F37]/20">
                  <td className="py-4 px-4 font-medium dark:text-gray-100 light:text-gray-800">
                    Direct YouTube Upload
                  </td>
                  <td className="py-4 px-4 text-center">
                    <CheckCircle2 className="h-5 w-5 text-[#E0115F] mx-auto" />
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Partial
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Limited
                  </td>
                  <td className="py-4 px-4 text-red-400 dark:text-red-400 light:text-red-600 text-center font-medium">
                    No
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Limited
                  </td>
                </tr>
                <tr className="border-b border-[#722F37]/30 dark:border-[#722F37]/30 light:border-[#722F37]/20">
                  <td className="py-4 px-4 font-medium dark:text-gray-100 light:text-gray-800">
                    Time to Create Short
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-[#E0115F] font-bold">Minutes</span>
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Hours
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Hours
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Hours
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Hours
                  </td>
                </tr>
                <tr className="border-b border-[#722F37]/30 dark:border-[#722F37]/30 light:border-[#722F37]/20">
                  <td className="py-4 px-4 font-medium dark:text-gray-100 light:text-gray-800">
                    Learning Curve
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-[#E0115F] font-bold">Minimal</span>
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Moderate
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Moderate
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Moderate
                  </td>
                  <td className="py-4 px-4 text-amber-400 dark:text-amber-400 light:text-amber-600 text-center font-medium">
                    Moderate
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .feature-card.show {
          opacity: 1;
          transform: translateY(0);
        }
        `,
        }}
      />
    </section>
  );
};

export default Features;
