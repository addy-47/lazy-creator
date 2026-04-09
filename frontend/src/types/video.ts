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
  thumbnail_hf_prompt?: string;
}

export interface GalleryResponse {
  status: string;
  videos: Video[];
}

export interface TaskStatus {
  status: string;
  progress: number;
  message: string;
  status_message?: string;
  estimated_time?: number;
  video?: Video;
  error?: string;
  video_url?: string;
}

export interface YouTubeShort {
  id: string;
  title: string;
  url?: string;         // Legacy compatibility
  thumbnailUrl?: string; // Standardized field
  videoUrl?: string;     // For demo/local playback
  youtubeUrl?: string;   // Link to YouTube
  views?: string;
  channelTitle?: string;
  channel?: string;      // Legacy compatibility
  _isDemo?: boolean;     // Internal flag for gallery logic
}
