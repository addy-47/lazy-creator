import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import performanceMonitor from "./utils/performance-monitor";

// Detect if we should run in performance mode
if (typeof window !== "undefined") {
  // Check for low-end devices or slow connection
  const isLowEndDevice =
    window.navigator.hardwareConcurrency < 4 ||
    // Use safer approach for connection API which might not be supported everywhere
    (navigator as any).connection?.effectiveType === "slow-2g" ||
    (navigator as any).connection?.effectiveType === "2g";

  // Set performance mode attribute to selectively disable heavy features
  if (isLowEndDevice) {
    document.documentElement.setAttribute("data-performance-mode", "high");
    console.info(
      "[Performance] Enabled high-performance mode for low-end device"
    );
  }
}

// Expose performance monitor to the global window object for console debugging
if (typeof window !== "undefined") {
  (window as any).performanceMonitor = performanceMonitor;

  // Add console commands for easier debugging
  console.info(
    "%c[Scroll Debug]%c Available commands:\n" +
      "- %cwindow.performanceMonitor.startMonitoring()%c: Start monitoring scroll performance\n" +
      "- %cwindow.performanceMonitor.stopMonitoring()%c: Stop monitoring\n" +
      "- %cwindow.performanceMonitor.logReport()%c: Show performance report",
    "color: #E0115F; font-weight: bold",
    "color: inherit",
    "color: #800000",
    "color: inherit",
    "color: #800000",
    "color: inherit",
    "color: #800000",
    "color: inherit"
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
