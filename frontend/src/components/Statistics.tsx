import { useRef } from "react";
import { Clock, Users, Video, Award } from "lucide-react";

// Static pre-defined stats to avoid any calculations
const stats = [
  {
    icon: <Clock className="h-8 w-8 text-amber-500" />,
    value: "85%",
    label: "Time Saved",
    description: "Average time saved compared to traditional video editing",
  },
  {
    icon: <Users className="h-8 w-8 text-blue-500" />,
    value: "25,000+",
    label: "Active Users",
    description: "Content creators using LazyCreator daily",
  },
  {
    icon: <Video className="h-8 w-8 text-green-500" />,
    value: "1,000,000+",
    label: "Videos Created",
    description: "YouTube Shorts generated through our platform",
  },
  {
    icon: <Award className="h-8 w-8 text-[#E0115F]" />,
    value: "98%",
    label: "Satisfaction Rate",
    description: "Users who would recommend LazyCreator",
  },
];

const Statistics = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <section
      ref={sectionRef}
      className="py-24 dark:bg-[#0A0A0A] light:bg-gray-100"
    >
      {/* Static content only */}
      <div className="container-wide">
        <div className="max-w-3xl mb-16 text-left">
          <h2 className="font-semibold mb-4 text-4xl text-transparent bg-clip-text bg-gradient-to-r from-[#800000] via-[#722F37] to-[#E0115F]">
            Performance Metrics
          </h2>
          <p className="text-lg dark:text-gray-300 light:text-gray-700">
            Quantifiable results that demonstrate our platform's
            industry-leading capabilities
          </p>
        </div>

        {/* Simplified static grid with no animations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="p-8 rounded-2xl bg-black/30 border border-[#722F37]/30"
            >
              <div className="rounded-full w-16 h-16 flex items-center justify-center bg-black/50 mb-6 border border-[#722F37]/20">
                {stat.icon}
              </div>

              <div className="font-bold text-3xl md:text-4xl text-white mb-2">
                {stat.value}
              </div>

              <h3 className="text-lg font-medium mb-1 text-[#E0115F]">
                {stat.label}
              </h3>
              <p className="text-gray-400 text-sm">{stat.description}</p>
            </div>
          ))}
        </div>

        {/* Simplified static metrics box */}
        <div className="mt-16 p-8 rounded-2xl border border-[#722F37]/30 bg-black/30">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-left w-full md:w-1/2">
              <h3 className="text-2xl font-medium mb-4 text-transparent bg-clip-text bg-gradient-to-r from-[#800000] to-[#E0115F]">
                Real-time Statistics
              </h3>
              <p className="text-gray-300 mb-6">
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

            {/* Static image instead of dynamic chart */}
            <div className="w-full md:w-1/2 aspect-[4/3] bg-black/40 rounded-xl border border-[#722F37]/30 overflow-hidden">
              <div className="h-full w-full p-4">
                <div className="h-full flex items-end">
                  {/* Static bars with pre-calculated heights */}
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "45%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "65%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "35%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "75%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "50%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "85%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "40%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "60%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "70%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "55%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "80%" }}
                  ></div>
                  <div
                    className="w-full bg-gradient-to-t from-[#800000] to-[#E0115F] mx-0.5 rounded-t-sm"
                    style={{ height: "30%" }}
                  ></div>
                </div>
                <div className="mt-2 h-px bg-[#722F37]/30"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Statistics;
