import { lzySvcApi, handleApiError } from "./client";
import { YouTubeChannel, YouTubeStatus, YouTubeUploadMetadata } from "@/types/youtube";
import { ApiResponse } from "@/types/common";

export const youtubeApi = {
  getStatus: async (): Promise<ApiResponse<YouTubeStatus>> => {
    try {
      const response = await lzySvcApi.get('/youtube/status');
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  getChannels: async (): Promise<ApiResponse<{ channels: YouTubeChannel[] }>> => {
    try {
      const response = await lzySvcApi.get('/youtube/channels');
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  startAuth: async (): Promise<ApiResponse<{ auth_url: string }>> => {
    try {
      const response = await lzySvcApi.get('/youtube/auth-start');
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  authCallback: async (code: string, state: string, redirectUri: string): Promise<ApiResponse<{ token?: string }>> => {
    try {
      const response = await lzySvcApi.get(`/youtube/auth-callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  disconnect: async (): Promise<ApiResponse<{ message?: string }>> => {
    try {
      const response = await lzySvcApi.delete('/youtube/disconnect');
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },

  upload: async (videoId: string, metadata: YouTubeUploadMetadata): Promise<ApiResponse<{ youtube_id?: string }>> => {
    try {
      const response = await lzySvcApi.post(`/youtube/upload/${videoId}`, metadata);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
