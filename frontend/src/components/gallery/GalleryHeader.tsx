import React from "react";
import { SearchIcon } from "lucide-react";

interface GalleryHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const GalleryHeader: React.FC<GalleryHeaderProps> = ({
  searchQuery,
  setSearchQuery,
}) => {
  return (  
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 mb-8 border-b border-border/50 pb-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold md:text-5xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          Content Library
        </h1>
        <p className="text-muted-foreground">
          Manage your generated shorts and explore trending inspirations.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
        <div className="relative group flex-1 md:w-[350px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search your creations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 focus:border-primary/50 focus:bg-background outline-none transition-all shadow-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default GalleryHeader;
