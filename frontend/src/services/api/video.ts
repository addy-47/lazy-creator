import { lzyDirectorApi, handleApiError } from "./client";
import { getToken } from "../tokenService";
import { getLzyDirectorBaseURL } from "../config";

export interface Video {
  id: string;
  title?: string;
  filename: string;
  thumbnailUrl?: string;
  createdAt?: string;
  status?: string;
  gcs_path: string;
  original_prompt: string;
  display_title?: string;
  duration: number;
  created_at: string;
  uploaded_to_yt: boolean;
  youtube_id: string | null;
  comprehensive_content?: {
    title?: string;
    description?: string;
    thumbnail_hf_prompt?: string;
    thumbnail_unsplash_query?: string;
  };
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
 * Video Generation & Management API
 */
export const videoApi = {
  generate: async (formData: FormData): Promise<{ data: { status: string; task_id: string } }> => {
    try {
      const response = await lzyDirectorApi.post('/api/v1/generate-short', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getTaskStatus: async (taskId: string): Promise<{ data: TaskStatus }> => {
    try {
      const response = await lzyDirectorApi.get(`/api/v1/tasks/${taskId}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getVideos: async (): Promise<{ data: GalleryResponse }> => {
    try {
      const response = await lzyDirectorApi.get('/api/v1/gallery');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getGallery: async (): Promise<{ data: GalleryResponse }> => {
    try {
      const response = await lzyDirectorApi.get('/api/v1/gallery');
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getVideoUrl: (filename: string): string => {
    const token = getToken();
    const base = getLzyDirectorBaseURL();
    // For direct video loading in <video> tags
    return `${base}/api/v1/gallery/${filename}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  
  download: async (videoId: string, filename: string): Promise<void> => {
    try {
      const response = await lzyDirectorApi.get(`/api/v1/download/${videoId}`, {
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
      const response = await lzyDirectorApi.delete(`/api/v1/videos/${videoId}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  cancel: async (videoId: string): Promise<{ data: { status: string } }> => {
    try {
      const response = await lzyDirectorApi.post(`/api/v1/cancel-video/${videoId}`);
      return response;
    } catch (error) {
      handleApiError(error);
    }
  },
};
