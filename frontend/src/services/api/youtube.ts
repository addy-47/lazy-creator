import { lzySvcApi, handleApiError } from "./client";

export const youtubeApi = {
  getStatus: async (): Promise<{ data: { status: string; authenticated: boolean; is_connected: boolean; message?: string } }> => {
    try {
      const response = await lzySvcApi.get('/youtube/status');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },

  getChannels: async (): Promise<{ data: { status: string; channels: any[] } }> => {
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

  upload: async (videoUrl: string, metadata: any): Promise<{ data: any }> => {
    try {
      // Backend expects video_url as a query parameter
      const response = await lzySvcApi.post(`/youtube/upload?video_url=${encodeURIComponent(videoUrl)}`, metadata);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
