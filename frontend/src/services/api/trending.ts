import { lzyDirectorApi, handleApiError } from "./client";
import { getToken } from "../tokenService";

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
      const token = getToken();
      const separator = "?";
      const tokenParam = token
        ? `${separator}token=${encodeURIComponent(token)}`
        : "";
      const fullUrl = `/api/youtube-trending-shorts${tokenParam}`;

      const response = await lzyDirectorApi.get(fullUrl);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
