export interface Video {
  id: string;
  filename: string;
  original_prompt: string;
  duration: number;
  created_at: string;
  uploaded_to_yt: boolean;
  youtube_id: string | null;
}

export interface DemoVideo {
  id: string;
  url: string;
  title?: string;
  views?: string;
  youtubeUrl?: string;
  channel?: string;
}

export interface UploadData {
  title: string;
  description: string;
  tags: string;
}
