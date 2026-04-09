import { lzySvcApi, handleApiError } from "./client";

/**
 * Fallback API for handling requests when the primary backend (Director) fails
 * or for specific orchestrator-direct actions.
 */
export const fallbackApi = {
  /**
   * Delete a video directly via the Go orchestrator service
   * @param videoId The ID of the video to delete
   */
  deleteVideo: async (videoId: string): Promise<any> => {
    try {
      const response = await lzySvcApi.delete(`/videos/${videoId}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
