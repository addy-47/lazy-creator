import React, { useState, useEffect } from "react";
import {
  Youtube,
  Info,
  Image as ImageIcon,
  Globe,
  Lock,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/Button";

interface UploadFormDialogProps {
  videoId: string;
  isUploading: boolean;
  uploadData: {
    title: string;
    description: string;
    tags: string;
    useThumbnail?: boolean;
    privacyStatus: "public" | "private" | "unlisted";
    channelId?: string;
  };
  generatedContent?: {
    title?: string;
    description?: string;
    thumbnail_hf_prompt?: string;
  };
  onUploadDataChange: (data: {
    title: string;
    description: string;
    tags: string;
    useThumbnail?: boolean;
    privacyStatus: "public" | "private" | "unlisted";
    channelId?: string;
  }) => void;
  onClose: () => void;
  onUpload: (videoId: string) => void;
  youtubeChannels?: Array<{ id: string; title: string; thumbnailUrl?: string }>;
}

const UploadFormDialog: React.FC<UploadFormDialogProps> = ({
  videoId,
  isUploading,
  uploadData,
  generatedContent,
  onUploadDataChange,
  onClose,
  onUpload,
  youtubeChannels = [],
}) => {
  const [showVerificationWarning, setShowVerificationWarning] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | undefined>(
    uploadData.channelId ||
      (youtubeChannels.length > 0 ? youtubeChannels[0].id : undefined)
  );

  // Update channel ID in uploadData when channels are loaded or selected channel changes
  useEffect(() => {
    if (youtubeChannels.length > 0 && !selectedChannel) {
      setSelectedChannel(youtubeChannels[0].id);
      onUploadDataChange({
        ...uploadData,
        channelId: youtubeChannels[0].id,
      });
    }
  }, [youtubeChannels, selectedChannel, uploadData, onUploadDataChange]);

  // Function to use AI-generated content
  const useGeneratedContent = () => {
    if (generatedContent) {
      onUploadDataChange({
        ...uploadData,
        title: generatedContent.title || uploadData.title,
        description: generatedContent.description || uploadData.description,
      });
    }
  };

  // Function to handle channel selection
  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const channelId = e.target.value;
    setSelectedChannel(channelId);
    onUploadDataChange({
      ...uploadData,
      channelId,
    });
  };

  // Function to handle privacy status change
  const handlePrivacyChange = (status: "public" | "private" | "unlisted") => {
    onUploadDataChange({
      ...uploadData,
      privacyStatus: status,
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card max-w-md w-full p-4 sm:p-6 rounded-2xl shadow-xl animate-scale-in border border-border my-4 sm:my-0">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Upload to YouTube</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-foreground/10"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div
          className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1"
          style={{
            scrollbarGutter: "stable",
            paddingRight: "16px",
            marginRight: "-4px",
          }}
        >
          {youtubeChannels.length > 1 && (
            <div>
              <label className="text-sm font-medium block mb-1">
                YouTube Channel
              </label>
              <select
                value={selectedChannel}
                onChange={handleChannelChange}
                className="w-full p-2 sm:p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none custom-scrollbar"
              >
                {youtubeChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm font-medium">Title</label>
              {generatedContent?.title && (
                <button
                  type="button"
                  onClick={useGeneratedContent}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  Use AI-generated content
                </button>
              )}
            </div>
            <input
              type="text"
              value={uploadData.title}
              onChange={(e) =>
                onUploadDataChange({
                  ...uploadData,
                  title: e.target.value,
                })
              }
              className="w-full p-2 sm:p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Description
            </label>
            <textarea
              value={uploadData.description}
              onChange={(e) =>
                onUploadDataChange({
                  ...uploadData,
                  description: e.target.value,
                })
              }
              className="w-full p-2 sm:p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none custom-scrollbar resize-y min-h-[80px]"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={uploadData.tags}
              onChange={(e) =>
                onUploadDataChange({
                  ...uploadData,
                  tags: e.target.value,
                })
              }
              className="w-full p-2 sm:p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Privacy Settings
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePrivacyChange("public")}
                className={`p-2 sm:p-3 rounded-lg flex flex-col items-center gap-1 border ${
                  uploadData.privacyStatus === "public"
                    ? "border-primary bg-primary/10"
                    : "border-input bg-background"
                }`}
              >
                <Globe size={16} />
                <span className="text-xs">Public</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrivacyChange("unlisted")}
                className={`p-2 sm:p-3 rounded-lg flex flex-col items-center gap-1 border ${
                  uploadData.privacyStatus === "unlisted"
                    ? "border-primary bg-primary/10"
                    : "border-input bg-background"
                }`}
              >
                <EyeOff size={16} />
                <span className="text-xs">Unlisted</span>
              </button>
              <button
                type="button"
                onClick={() => handlePrivacyChange("private")}
                className={`p-2 sm:p-3 rounded-lg flex flex-col items-center gap-1 border ${
                  uploadData.privacyStatus === "private"
                    ? "border-primary bg-primary/10"
                    : "border-input bg-background"
                }`}
              >
                <Lock size={16} />
                <span className="text-xs">Private</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Thumbnail</label>
              <button
                type="button"
                onClick={() =>
                  setShowVerificationWarning(!showVerificationWarning)
                }
                className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
              >
                <Info size={12} />
                Info
              </button>
            </div>

            {showVerificationWarning && (
              <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs p-3 rounded-lg mb-2">
                <p className="font-medium mb-1">
                  Channel Verification Required
                </p>
                <p>
                  YouTube requires your channel to be verified with at least
                  Intermediate level features to use custom thumbnails. Without
                  verification, YouTube will use a frame from your video
                  instead.
                </p>
              </div>
            )}

            <div className="flex flex-col space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={uploadData.useThumbnail === true}
                  onChange={() =>
                    onUploadDataChange({
                      ...uploadData,
                      useThumbnail: true,
                    })
                  }
                  className="accent-primary"
                />
                <span className="text-sm">Use AI-generated thumbnail</span>
              </label>
              {generatedContent?.thumbnail_hf_prompt && (
                <span
                  className="text-xs text-muted-foreground italic truncate pl-5 -mt-1"
                  title={generatedContent.thumbnail_hf_prompt}
                >
                  {generatedContent.thumbnail_hf_prompt}
                </span>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={uploadData.useThumbnail === false}
                  onChange={() =>
                    onUploadDataChange({
                      ...uploadData,
                      useThumbnail: false,
                    })
                  }
                  className="accent-primary"
                />
                <span className="text-sm">
                  Let YouTube select a frame from the video
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="rounded-full">
            Cancel
          </Button>
          <button
            onClick={() => {
              if (!isUploading) {
                onUpload(videoId);
              }
            }}
            disabled={isUploading}
            className="rounded-full min-w-[100px] h-10 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none shadow-sm transition-all duration-300"
          >
            {isUploading ? (
              <div className="inline-flex items-center">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>Uploading...</span>
              </div>
            ) : (
              <div className="inline-flex items-center">
                <Youtube size={16} className="mr-2" />
                <span>Upload</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadFormDialog;
