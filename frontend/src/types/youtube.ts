export interface YouTubeChannel {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  thumbnailUrl?: string; // Compatibility with legacy components
  customUrl?: string;
}

export interface YouTubeStatus {
  authenticated: boolean;
  is_connected: boolean;
}

export interface YouTubeUploadRequest {
  title: string;
  description: string;
  tags?: string | string[];
  privacyStatus: "public" | "private" | "unlisted";
  useThumbnail?: boolean;
  channelId?: string;
  category_id?: string;
}

export interface YouTubeUploadMetadata {
  title: string;
  description: string;
  tags?: string[];
  privacy_status: "public" | "private" | "unlisted";
  category_id?: string;
  made_for_kids?: boolean;
}

export interface UploadData {
  video_id: string;
  title: string;
  description: string;
  tags?: string[];
  privacy_status: "public" | "private" | "unlisted";
}
