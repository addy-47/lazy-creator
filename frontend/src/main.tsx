import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import performanceMonitor from "./utils/performance-monitor";

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
