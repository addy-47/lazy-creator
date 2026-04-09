import { Video } from "@/services/api/video";
export type { Video };

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
  privacyStatus: "public" | "private" | "unlisted";
  channelId?: string;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  thumbnailUrl?: string;
  customUrl?: string;
}
