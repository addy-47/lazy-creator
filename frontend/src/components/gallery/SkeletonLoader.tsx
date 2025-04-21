import { Video } from "./types";

interface SkeletonLoaderProps {
  message?: string;
  showSingle?: boolean;
  count?: number;
}

const SkeletonLoader = ({
  message = "Your created short will appear here",
  showSingle = false,
  count = 8,
}: SkeletonLoaderProps) => {
  // If showSingle is true, we display only one card with the message
  if (showSingle) {
    return (
      <div className="mt-4">
        <div className="rounded-lg overflow-hidden bg-card shadow-sm border border-border/40 animate-pulse">
          {/* Video thumbnail skeleton */}
          <div className="relative pb-[177.77%] bg-muted">
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
              <div className="w-12 h-12 rounded-full bg-muted-foreground/20"></div>
              <p className="text-center text-muted-foreground font-medium px-4">
                {message}
              </p>
            </div>
          </div>

          {/* Video info skeleton */}
          <div className="p-3 space-y-2">
            <div className="h-5 bg-muted-foreground/20 rounded w-3/4"></div>
            <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>

            {/* Buttons skeleton */}
            <div className="flex gap-2 mt-3 pt-2">
              <div className="h-8 bg-muted-foreground/20 rounded w-1/3"></div>
              <div className="h-8 bg-muted-foreground/20 rounded w-1/3"></div>
              <div className="h-8 bg-muted-foreground/20 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original multi-card skeleton loader
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="rounded-lg overflow-hidden bg-card shadow-sm border border-border/40 animate-pulse"
        >
          {/* Video thumbnail skeleton */}
          <div className="relative pb-[177.77%] bg-muted">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-muted-foreground/20"></div>
            </div>
          </div>

          {/* Video info skeleton */}
          <div className="p-3 space-y-2">
            <div className="h-5 bg-muted-foreground/20 rounded w-3/4"></div>
            <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>

            {/* Buttons skeleton */}
            <div className="flex gap-2 mt-3 pt-2">
              <div className="h-8 bg-muted-foreground/20 rounded w-1/3"></div>
              <div className="h-8 bg-muted-foreground/20 rounded w-1/3"></div>
              <div className="h-8 bg-muted-foreground/20 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonLoader;
