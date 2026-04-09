import { AxiosResponse } from "axios";
import { lzySvcApi, handleApiError } from "./client";
import { YouTubeShort } from "@/types/video";
import { ApiResponse } from "@/types/common";


/**
 * Trending Content API
 */
export const trendingApi = {  
  getYouTubeShorts: async (): Promise<AxiosResponse<ApiResponse<{ shorts: YouTubeShort[] }>>> => {
    try {
      const response = await lzySvcApi.get("/api/youtube-trending-shorts");
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
