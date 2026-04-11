import { videoApi } from "./api";
import { TaskStatus } from "@/types/video";

export interface PollingOptions {
  interval?: number;
  maxRetries?: number;
  onUpdate?: (data: TaskStatus) => void;
  onSuccess?: (data: TaskStatus) => void;
  onError?: (error: Error) => void;
}

/**
 * PollingService handles periodic status checks for long-running video generation tasks.
 * It replaces the previous WebSocket-based implementation for better reliability
 * across different network environments.
 */
export class PollingService {
  private static activePolls: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Starts polling for a specific video task's status.
   */
  static startPolling(videoId: string, options: PollingOptions) {
    const { 
      interval = 3000, 
      onUpdate, 
      onSuccess, 
      onError 
    } = options;

    // Clear existing poll for this video if any
    this.stopPolling(videoId);

    console.log(`Starting polling for video: ${videoId}`);

    const poll = async () => {
      try {
        const response = await videoApi.getTaskStatus(videoId);
        const data = response as unknown as TaskStatus;

        if (onUpdate) onUpdate(data);

        // Check if completed
        if (data.status === "completed" || data.progress === 100) {
          this.stopPolling(videoId);
          if (onSuccess) onSuccess(data);
          return;
        }

        // Check if failed
        if (data.status === "error" || data.status === "failed") {
          this.stopPolling(videoId);
          if (onError) onError(new Error(data.error || "Generation failed"));
          return;
        }

        // Schedule next poll
        const timeout = setTimeout(poll, interval);
        this.activePolls.set(videoId, timeout);
      } catch (error) {
        console.error(`Polling error for ${videoId}:`, error);
        
        // Don't stop on single network error, try again
        const timeout = setTimeout(poll, interval * 2); // Backoff
        this.activePolls.set(videoId, timeout);
      }
    };

    // Run first poll
    poll();
  }

  /**
   * Stops polling for a specific video task.
   */
  static stopPolling(videoId: string) {
    if (this.activePolls.has(videoId)) {
      clearTimeout(this.activePolls.get(videoId));
      this.activePolls.delete(videoId);
      console.log(`Stopped polling for video: ${videoId}`);
    }
  }

  /**
   * Stops all active polls.
   */
  static stopAll() {
    this.activePolls.forEach((timeout) => clearTimeout(timeout));
    this.activePolls.clear();
  }
}
