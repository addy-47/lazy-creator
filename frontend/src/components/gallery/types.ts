export interface Video {
  id: string;
  filename: string;
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
  useThumbnail?: boolean;
}
