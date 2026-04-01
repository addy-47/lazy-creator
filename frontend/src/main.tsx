import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Detect if we should run in performance mode for low-end devices
if (typeof window !== "undefined") {
  const isLowEndDevice =
    window.navigator.hardwareConcurrency < 4 ||
    (navigator as any).connection?.effectiveType === "slow-2g" ||
    (navigator as any).connection?.effectiveType === "2g";

  if (isLowEndDevice) {
    document.documentElement.setAttribute("data-performance-mode", "high");
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
