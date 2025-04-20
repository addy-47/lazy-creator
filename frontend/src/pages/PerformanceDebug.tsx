import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import performanceMonitor from "@/utils/performance-monitor";

// Add this page to your routes, but protect it in production

const PerformanceDebug = () => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [stats, setStats] = useState<any>({
    averageFps: 0,
    longTaskCount: 0,
    scrollJankCount: 0,
    worstJank: 0,
    longestTask: 0,
  });
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [memoryData, setMemoryData] = useState<any[]>([]);

  // Start/stop monitoring
  const toggleMonitoring = () => {
    if (isMonitoring) {
      performanceMonitor.stopMonitoring();
      // Get final stats
      const finalStats = performanceMonitor.logData();
      setStats(finalStats);
      console.log("Performance monitoring stopped");
    } else {
      performanceMonitor.startMonitoring();
      console.log("Performance monitoring started");
    }
    setIsMonitoring(!isMonitoring);
  };

  // Update stats periodically while monitoring
  useEffect(() => {
    if (!isMonitoring) return;

    const intervalId = setInterval(() => {
      const currentData = performanceMonitor.getData();
      setFpsHistory([...currentData.fps]);
      setMemoryData([...currentData.memoryUsage]);

      // Also update summary stats
      const summaryStats = {
        averageFps: currentData.fps.length
          ? currentData.fps.reduce((sum, fps) => sum + fps, 0) /
            currentData.fps.length
          : 0,
        longTaskCount: currentData.longTasks.length,
        scrollJankCount: currentData.scrollJank.length,
        worstJank: Math.max(
          ...currentData.scrollJank.map((j) => j.timeBetweenFrames),
          0
        ),
        longestTask: Math.max(
          ...currentData.longTasks.map((t) => t.duration),
          0
        ),
      };
      setStats(summaryStats);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isMonitoring]);

  const downloadPerformanceData = () => {
    const data = performanceMonitor.exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-data-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate simplified FPS chart using ASCII
  const renderFPSChart = () => {
    if (fpsHistory.length === 0) return "No data yet";

    const maxHeight = 10;
    const maxFPS = Math.max(...fpsHistory, 60);
    const normalizedValues = fpsHistory.map((fps) =>
      Math.round((fps / maxFPS) * maxHeight)
    );

    let chart = "";

    for (let row = maxHeight; row >= 0; row--) {
      const rowLabel =
        row === maxHeight ? maxFPS.toString() : row === 0 ? "0" : "";

      chart += `${rowLabel.padStart(3, " ")} `;

      normalizedValues.forEach((value) => {
        chart += value >= row ? "█" : " ";
      });

      chart += "\n";
    }

    chart += "    " + "─".repeat(normalizedValues.length) + "\n";
    chart += "    " + "Time →";

    return chart;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">Performance Debug Dashboard</h1>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Performance Monitoring</CardTitle>
              <CardDescription>
                Track FPS, long tasks, and scroll jank to identify performance
                issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={toggleMonitoring}
                variant={isMonitoring ? "destructive" : "default"}
                className="w-full mb-4"
              >
                {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
              </Button>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Average FPS:</p>
                  <p className="text-2xl font-bold">
                    {stats.averageFps.toFixed(1)}
                    <span className="text-sm font-normal ml-1 text-muted-foreground">
                      {stats.averageFps >= 55
                        ? "(Good)"
                        : stats.averageFps >= 30
                        ? "(Acceptable)"
                        : "(Poor)"}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium">Long Tasks:</p>
                  <p className="text-2xl font-bold">
                    {stats.longTaskCount}
                    <span className="text-sm font-normal ml-1 text-muted-foreground">
                      {stats.longestTask > 0
                        ? `(Longest: ${stats.longestTask.toFixed(0)}ms)`
                        : ""}
                    </span>
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium">Scroll Jank Instances:</p>
                  <p className="text-2xl font-bold">
                    {stats.scrollJankCount}
                    <span className="text-sm font-normal ml-1 text-muted-foreground">
                      {stats.worstJank > 0
                        ? `(Worst: ${stats.worstJank.toFixed(0)}ms)`
                        : ""}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={downloadPerformanceData}
                disabled={!isMonitoring && stats.longTaskCount === 0}
                className="w-full"
              >
                Download Performance Data
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>FPS History</CardTitle>
              <CardDescription>
                Frame rate over time (higher is better)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-muted p-2 rounded-md overflow-x-auto">
                {renderFPSChart()}
              </pre>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2 items-start">
              <p className="text-sm">
                <span className="font-medium">Diagnosing Issues:</span> FPS
                consistently below 30 indicates performance problems.
              </p>
              <p className="text-sm">
                <span className="font-medium">Common Causes:</span> Excessive
                DOM operations, unoptimized event handlers, or heavy CPU tasks.
              </p>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">
            Troubleshooting Instructions
          </h2>

          <ol className="list-decimal pl-5 space-y-2">
            <li>Start monitoring before reproducing the performance issue</li>
            <li>Perform the actions that cause the scrolling problem</li>
            <li>Stop monitoring and check the results</li>
            <li>Look for patterns in long tasks and scroll jank</li>
            <li>Download the data and share with developers if needed</li>
          </ol>

          <p className="mt-4 text-sm text-muted-foreground">
            This tool can help identify when and where performance issues occur.
            The data collected can be used by developers to optimize the
            application further.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PerformanceDebug;
