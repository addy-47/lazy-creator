/**
 * Simple performance monitoring utility to identify scroll jank and performance issues
 */

interface ScrollJankRecord {
  timestamp: number;
  frameDuration: number;
}

interface PerformanceData {
  fps: number[];
  jankRecords: ScrollJankRecord[];
  longTasksCount: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private isMonitoring = false;
  private rafId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private lastFpsUpdate = 0;
  private data: PerformanceData = {
    fps: [],
    jankRecords: [],
    longTasksCount: 0,
  };
  private longTaskObserver: PerformanceObserver | null = null;

  // Make this a singleton
  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start monitoring scroll performance
   */
  public startMonitoring() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Reset data
    this.data = {
      fps: [],
      jankRecords: [],
      longTasksCount: 0,
    };

    // Monitor FPS
    this.monitorFps();

    // Monitor for long tasks if browser supports it
    this.monitorLongTasks();

    console.log("Performance monitoring started");
  }

  /**
   * Stop monitoring performance
   */
  public stopMonitoring() {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }

    console.log("Performance monitoring stopped");
  }

  /**
   * Get the current performance data
   */
  public getData(): PerformanceData {
    return this.data;
  }

  /**
   * Log a report of the performance data
   */
  public logReport(): void {
    const averageFps = this.calculateAverageFps();
    const worstJank = this.findWorstJank();
    const jankCount = this.data.jankRecords.length;

    console.log("=== Performance Report ===");
    console.log(`Average FPS: ${averageFps.toFixed(1)}`);
    console.log(`Jank Instances: ${jankCount}`);
    console.log(`Worst Jank: ${worstJank.toFixed(1)}ms`);
    console.log(`Long Task Count: ${this.data.longTasksCount}`);

    if (averageFps < 30) {
      console.warn(
        "FPS is too low! This indicates serious performance issues."
      );
    } else if (averageFps < 50) {
      console.warn("FPS is suboptimal. Consider performance optimizations.");
    }

    if (jankCount > 5) {
      console.warn(
        "Multiple jank instances detected. This can cause visible stutters."
      );
    }

    if (this.data.longTasksCount > 0) {
      console.warn(
        "Long tasks detected. These can block the main thread and cause stuttering."
      );
    }
  }

  /**
   * Calculate the average FPS from the recorded data
   */
  private calculateAverageFps(): number {
    if (this.data.fps.length === 0) return 0;
    const sum = this.data.fps.reduce((acc, fps) => acc + fps, 0);
    return sum / this.data.fps.length;
  }

  /**
   * Find the worst jank instance (longest frame duration)
   */
  private findWorstJank(): number {
    if (this.data.jankRecords.length === 0) return 0;
    return Math.max(
      ...this.data.jankRecords.map((record) => record.frameDuration)
    );
  }

  /**
   * Monitor frames per second using requestAnimationFrame
   */
  private monitorFps() {
    const updateFps = (timestamp: number) => {
      if (!this.isMonitoring) return;

      if (this.lastFrameTime > 0) {
        const frameDuration = timestamp - this.lastFrameTime;

        // Consider a frame duration over 50ms (under 20fps) as jank
        if (frameDuration > 50) {
          this.data.jankRecords.push({
            timestamp,
            frameDuration,
          });

          // Keep only the last 50 jank records
          if (this.data.jankRecords.length > 50) {
            this.data.jankRecords.shift();
          }
        }

        // Update FPS counter
        this.frameCount++;
      }

      this.lastFrameTime = timestamp;

      // Update FPS every second
      if (timestamp - this.lastFpsUpdate >= 1000) {
        const fps = Math.round(
          (this.frameCount * 1000) / (timestamp - this.lastFpsUpdate)
        );
        this.data.fps.push(fps);

        // Keep only the last 60 FPS readings (1 minute at 1 reading/second)
        if (this.data.fps.length > 60) {
          this.data.fps.shift();
        }

        this.frameCount = 0;
        this.lastFpsUpdate = timestamp;
      }

      this.rafId = requestAnimationFrame(updateFps);
    };

    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.lastFrameTime = 0;
    this.rafId = requestAnimationFrame(updateFps);
  }

  /**
   * Monitor for long tasks that block the main thread
   */
  private monitorLongTasks() {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    try {
      this.longTaskObserver = new PerformanceObserver((entries) => {
        // Count long tasks (tasks over 50ms will cause visible jank)
        this.data.longTasksCount += entries.getEntries().length;
      });

      this.longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch (error) {
      console.warn("Long task monitoring not supported", error);
    }
  }
}

// Export the singleton instance
export default PerformanceMonitor.getInstance();
