import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType: string;
  };
}

// Detect if we should run in performance mode for low-end devices
if (typeof window !== "undefined") {
  const nav = navigator as NavigatorWithConnection;
  const isLowEndDevice =
    window.navigator.hardwareConcurrency < 4 ||
    nav.connection?.effectiveType === "slow-2g" ||
    nav.connection?.effectiveType === "2g";

  if (isLowEndDevice) {
    document.documentElement.setAttribute("data-performance-mode", "high");
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
