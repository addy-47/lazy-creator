import React, { useEffect } from "react";
import {
  Youtube,
  Globe,
  Lock,
  EyeOff,
  X,
} from "lucide-react";
import { Button } from "@/components/Button";
import { UploadData, YouTubeChannel } from "@/types/youtube";

interface UploadFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  uploadData: UploadData;
  setUploadData: React.Dispatch<React.SetStateAction<UploadData>>;
  onUpload: () => void;
  uploading: boolean;
  youtubeChannels: YouTubeChannel[];
  selectedYouTubeChannel: YouTubeChannel | null;
  setSelectedYouTubeChannel: (channel: YouTubeChannel | null) => void;
}

const UploadFormDialog: React.FC<UploadFormDialogProps> = ({
  isOpen,
  onClose,
  uploadData,
  setUploadData,
  onUpload,
  uploading,
  youtubeChannels,
  selectedYouTubeChannel,
  setSelectedYouTubeChannel,
}) => {

  useEffect(() => {
    if (youtubeChannels.length > 0 && !selectedYouTubeChannel) {
      setSelectedYouTubeChannel(youtubeChannels[0]);
    }
  }, [youtubeChannels, selectedYouTubeChannel, setSelectedYouTubeChannel]);

  if (!isOpen) return null;

  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const channel = youtubeChannels.find(c => c.id === e.target.value) || null;
    setSelectedYouTubeChannel(channel);
  };

  const updateField = <K extends keyof UploadData>(field: K, value: UploadData[K]) => {
    setUploadData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg">
              <Youtube className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-xl font-bold">Upload to YouTube</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {youtubeChannels.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-80">Target Channel</label>
              <select
                value={selectedYouTubeChannel?.id || ""}
                onChange={handleChannelChange}
                className="w-full p-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                {youtubeChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-80">Video Title</label>
            <input
              type="text"
              value={uploadData.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="w-full p-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              placeholder="Enter viral title..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold opacity-80">Description</label>
            <textarea
              value={uploadData.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="w-full p-3 rounded-xl bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all h-32 resize-none"
              placeholder="Tell your viewers about this short..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold opacity-80">Privacy</label>
              <div className="flex bg-muted/50 p-1 rounded-xl border border-border">
                {["public", "private", "unlisted"].map((status) => (
                  <button
                    key={status}
                    onClick={() => updateField("privacy_status", status as "public" | "private" | "unlisted")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      uploadData.privacy_status === status 
                        ? "bg-background text-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {status === "public" && <Globe className="w-3.5 h-3.5" />}
                    {status === "private" && <Lock className="w-3.5 h-3.5" />}
                    {status === "unlisted" && <EyeOff className="w-3.5 h-3.5" />}
                    <span className="capitalize">{status}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border bg-muted/30 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl"
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={onUpload}
            className="flex-1 rounded-xl gap-2"
            disabled={uploading || !uploadData.title}
          >
            <Youtube className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload Now"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UploadFormDialog;
