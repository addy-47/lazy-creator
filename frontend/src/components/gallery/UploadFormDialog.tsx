import React, { useState } from "react";
import { Youtube, Info, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/Button";

interface UploadFormDialogProps {
  videoId: string;
  isUploading: boolean;
  uploadData: {
    title: string;
    description: string;
    tags: string;
    useThumbnail?: boolean;
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
  }) => void;
  onClose: () => void;
  onUpload: (videoId: string) => void;
}

const UploadFormDialog: React.FC<UploadFormDialogProps> = ({
  videoId,
  isUploading,
  uploadData,
  generatedContent,
  onUploadDataChange,
  onClose,
  onUpload,
}) => {
  const [showVerificationWarning, setShowVerificationWarning] = useState(false);

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

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card max-w-md w-full p-6 rounded-2xl shadow-xl animate-scale-in border border-border">
        <h3 className="text-xl font-semibold mb-6">Upload to YouTube</h3>

        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
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
              className="w-full p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
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
              className="w-full p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
              rows={4}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
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
              className="w-full p-3 rounded-lg bg-background border border-input focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
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
              <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs p-3 rounded-lg mb-3">
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
                {generatedContent?.thumbnail_hf_prompt && (
                  <span
                    className="text-xs text-muted-foreground italic truncate max-w-[200px]"
                    title={generatedContent.thumbnail_hf_prompt}
                  >
                    {generatedContent.thumbnail_hf_prompt}
                  </span>
                )}
              </label>
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

        <div className="flex flex-wrap justify-end gap-3 mt-8">
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
