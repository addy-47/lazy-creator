import React from "react";
import { Youtube } from "lucide-react";
import { Button } from "@/components/Button";

interface UploadFormDialogProps {
  videoId: string;
  isUploading: boolean;
  uploadData: {
    title: string;
    description: string;
    tags: string;
  };
  onUploadDataChange: (data: {
    title: string;
    description: string;
    tags: string;
  }) => void;
  onClose: () => void;
  onUpload: (videoId: string) => void;
}

const UploadFormDialog: React.FC<UploadFormDialogProps> = ({
  videoId,
  isUploading,
  uploadData,
  onUploadDataChange,
  onClose,
  onUpload,
}) => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card max-w-md w-full p-6 rounded-2xl shadow-xl animate-scale-in border border-border">
        <h3 className="text-xl font-semibold mb-6">Upload to YouTube</h3>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium block mb-2">Title</label>
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
        </div>

        <div className="flex flex-wrap justify-end gap-3 mt-8">
          <Button variant="outline" onClick={onClose} className="rounded-full">
            Cancel
          </Button>
          <Button
            onClick={() => onUpload(videoId)}
            disabled={isUploading}
            className="rounded-full"
          >
            {isUploading ? (
              <>
                <div className="h-4 w-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2"></div>
                Uploading...
              </>
            ) : (
              <>
                <Youtube size={16} className="mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UploadFormDialog;
