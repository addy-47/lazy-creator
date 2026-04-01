import { lzySvcApi, handleApiError } from "./client";

export interface YouTubeChannel {
  id: string;
  title: string;
  thumbnail: string;
  subscribers?: string;
}

export interface YouTubeStatus {
  status: string;
  authenticated: boolean;
  is_connected: boolean;
}

/**
 * YouTube Connection API
 */
export const youtubeApi = {
  getStatus: async (): Promise<{ data: YouTubeStatus }> => {
    try {
      const response = await lzySvcApi.get('/youtube/status');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getChannels: async (): Promise<{ data: { status: string; channels: YouTubeChannel[] } }> => {
    try {
      const response = await lzySvcApi.get('/youtube/channels');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  startAuth: async (): Promise<{ data: { status: string; auth_url: string } }> => {
    try {
      const response = await lzySvcApi.get('/youtube/auth-start');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  upload: async (videoUrl: string): Promise<{ data: { status: string; message: string } }> => {
    try {
      const response = await lzySvcApi.post('/youtube/upload', null, {
        params: { video_url: videoUrl }
      });
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
