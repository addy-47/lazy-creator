import { lzySvcApi, handleApiError } from "./client";

export interface YouTubeShort {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  youtubeUrl?: string;
  views?: string;
}

/**
 * Trending Content API
 */
export const trendingApi = {  
  getYouTubeShorts: async (): Promise<{ data: { status: string; shorts: YouTubeShort[] } }> => {
    try {
      const response = await lzySvcApi.get("/api/youtube-trending-shorts");
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
