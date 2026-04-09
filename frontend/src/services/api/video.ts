import { lzySvcApi, handleApiError } from "./client";
import { getToken } from "../tokenService";
import { getLzySvcBaseURL } from "../config";

export interface Video {
  id: string;
  task_id: string;
  user_id: string;
  status: string;
  progress: number;
  title: string;
  description: string;
  script: string;
  duration_seconds: number;
  video_path: string;
  thumbnail_path: string;
  resolution: number[];
  fps: number;
  background_type: string;
  background_source: string;
  prompt: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error_message?: string;
  youtube_video_id?: string;
  youtube_url?: string;
}

export interface GalleryResponse {
  status: string;
  videos: Video[];
}

export interface TaskStatus {
  status: string;
  progress: number;
  message: string;
  error?: string;
  video_url?: string;
}

/**
 * Video Generation & Management API - Now orchestrated via Go service
 */
export const videoApi = {
  generate: async (formData: FormData): Promise<{ data: { status: string; task_id: string; message: string } }> => {
    try {
      const response = await lzySvcApi.post('/videos/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getTaskStatus: async (taskId: string): Promise<{ data: Video }> => {
    try {
      const response = await lzySvcApi.get(`/videos/status/${taskId}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getVideos: async (limit = 20, skip = 0): Promise<{ data: GalleryResponse }> => {
    try {
      const response = await lzySvcApi.get(`/videos?limit=${limit}&skip=${skip}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getGallery: async (limit = 20, skip = 0): Promise<{ data: GalleryResponse }> => {
    try {
      const response = await lzySvcApi.get(`/videos?limit=${limit}&skip=${skip}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getVideoUrl: (filename: string): string => {
    const token = getToken();
    const base = getLzySvcBaseURL();
    // For direct video loading (if served by Go)
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
  
  delete: async (videoId: string): Promise<{ data: { status: string } }> => {
    try {
      const response = await lzySvcApi.delete(`/videos/${videoId}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  cancel: async (videoId: string): Promise<{ data: { status: string } }> => {
    try {
      const response = await lzySvcApi.post(`/videos/cancel/${videoId}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
