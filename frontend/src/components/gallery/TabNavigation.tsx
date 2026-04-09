import React from "react";
import { Sparkles } from "lucide-react";

interface TabNavigationProps {
  activeSection: "my-videos" | "explore";
  onTabChange: (section: "my-videos" | "explore") => void;
  videoCount?: number;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeSection,
  onTabChange,
  videoCount = 0,
}) => {
  return (
    <div className="mb-8 border-b">
      <div className="flex space-x-6">
        <button
          onClick={() => onTabChange("my-videos")}
          className={`pb-2 px-1 font-medium relative flex items-center gap-2 ${
            activeSection === "my-videos"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>My Videos</span>
          {videoCount > 0 && (
            <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold rounded-full ${
              activeSection === "my-videos" 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted text-muted-foreground"
            }`}>
              {videoCount}
            </span>
          )}
          {activeSection === "my-videos" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full transition-all duration-300" />
          )}
        </button>

        <button
          onClick={() => onTabChange("explore")}
          className={`pb-2 px-1 font-medium relative flex items-center gap-1 ${
            activeSection === "explore"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>Explore</span>
          <Sparkles size={14} className="opacity-70" />
          {activeSection === "explore" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>
    </div>
  );
};

export default TabNavigation;
