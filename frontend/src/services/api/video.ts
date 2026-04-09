import { lzySvcApi, handleApiError } from "./client";
import { getToken } from "../tokenService";
import { getLzySvcBaseURL } from "../config";
import { Video, GalleryResponse } from "@/types/video";
import { ApiResponse } from "@/types/common";

/**
 * Video Generation & Management API - Now orchestrated via Go service
 */
export const videoApi = {
  generate: async (formData: FormData): Promise<ApiResponse<{ status: string; task_id: string; message: string }>> => {
    try {
      const response = await lzySvcApi.post('/videos/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  getTaskStatus: async (taskId: string): Promise<ApiResponse<Video>> => {
    try {
      const response = await lzySvcApi.get(`/videos/status/${taskId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  getVideos: async (limit = 20, skip = 0): Promise<ApiResponse<GalleryResponse>> => {
    try {
      const response = await lzySvcApi.get(`/videos?limit=${limit}&skip=${skip}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  getGallery: async (limit = 20, skip = 0): Promise<ApiResponse<GalleryResponse>> => {
    try {
      const response = await lzySvcApi.get(`/videos?limit=${limit}&skip=${skip}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  getVideoUrl: (filename: string): string => {
    const token = getToken();
    const base = getLzySvcBaseURL();
    return `${base}/api/v1/lzy-svc/videos/download/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  
  download: async (videoId: string, filename: string): Promise<void> => {
    try {
      const response = await lzySvcApi.get(`/videos/download/${videoId}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      handleApiError(error);
    }
  },
  
  delete: async (videoId: string): Promise<ApiResponse<{ status: string }>> => {
    try {
      const response = await lzySvcApi.delete(`/videos/${videoId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
  
  cancel: async (videoId: string): Promise<ApiResponse<{ status: string }>> => {
    try {
      const response = await lzySvcApi.post(`/videos/cancel/${videoId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  },
};
