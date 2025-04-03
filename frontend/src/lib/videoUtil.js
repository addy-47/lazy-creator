/**
 * Utility for handling video playback without redirecting to YouTube
 */

/**
 * Handles video click for demo videos - plays in place without redirecting
 * @param {Event} e Click event
 * @param {Object} demo The video demo object
 * @param {string} videoElementId The ID of the video element
 */
export function handleDemoVideoClick(e, demo, videoElementId) {
  // Prevent default behavior
  e.preventDefault();
  e.stopPropagation();

  // Check if video is from demo folder - those should never redirect
  const isLocalVideo = demo.url && demo.url.includes("/demo/");

  // Only redirect actual YouTube videos, not demo videos
  const shouldRedirect = demo.youtubeUrl && !isLocalVideo;

  if (shouldRedirect) {
    window.open(demo.youtubeUrl, "_blank");
  } else {
    // Play local video in place
    const videoElement = document.getElementById(videoElementId);

    if (videoElement) {
      // Toggle play/pause
      if (videoElement.paused) {
        // Pause all other videos first
        document.querySelectorAll("video").forEach((video) => {
          if (video.id !== videoElementId) {
            video.pause();
            video.muted = true;
          }
        });

        // Play with sound
        videoElement.muted = false;
        videoElement.play();
      } else {
        // Pause if already playing
        videoElement.pause();
      }
    }
  }
}
