// Define keyframes for smooth scrolling - only insert once
let keyframesAdded = false;

export function addScrollKeyframes() {
  if (typeof document !== "undefined" && !keyframesAdded) {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes scroll-left {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }

      @keyframes scroll-right {
        from { transform: translateX(-50%); }
        to { transform: translateX(0); }
      }

      .animation-paused {
        animation-play-state: paused !important;
      }
    `;
    document.head.append(style);
    keyframesAdded = true;
  }
}
