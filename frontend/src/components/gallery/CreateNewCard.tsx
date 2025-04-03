import React from "react";
import { Plus } from "lucide-react";

interface CreateNewCardProps {
  onClick: () => void;
}

const CreateNewCard: React.FC<CreateNewCardProps> = ({ onClick }) => {
  const cardWidthClass = "w-full";
  const cardClass = "aspect-[9/16] rounded-xl overflow-hidden";

  return (
    <div className={cardWidthClass}>
      <div
        className={`${cardClass} bg-gradient-to-br from-primary/5 via-background to-secondary/5 border border-primary/10 flex flex-col items-center justify-center cursor-pointer hover:from-primary/10 hover:to-secondary/10 transition-all duration-300 hover:shadow-md hover:shadow-primary/5 group relative`}
        onClick={onClick}
      >
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.07]"></div>

        <div className="p-3 rounded-full bg-primary/10 mb-3 group-hover:scale-110 transition-transform duration-300">
          <Plus size={30} className="text-primary" />
        </div>
        <p className="text-base font-medium">Create New</p>
        <p className="text-xs text-muted-foreground mt-1">Add a new short</p>
      </div>
    </div>
  );
};

export default CreateNewCard;
