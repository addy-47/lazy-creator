import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface DurationSliderProps {
  selectedDuration: number;
  onDurationChange: (duration: number) => void;
}

const durationOptions = [10, 15, 20, 25, 30];

const DurationSlider = ({
  selectedDuration,
  onDurationChange,
}: DurationSliderProps) => {
  const [value, setValue] = useState(2); // Default to 20 seconds (index 2)

  useEffect(() => {
    if (!selectedDuration) {
      onDurationChange(durationOptions[2]);
    } else {
      const durationIndex = durationOptions.indexOf(selectedDuration);
      if (durationIndex >= 0) {
        setValue(durationIndex);
      }
    }
  }, [selectedDuration, onDurationChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setValue(newValue);
    onDurationChange(durationOptions[newValue]);
  };

  const handleButtonClick = (index: number) => {
    setValue(index);
    onDurationChange(durationOptions[index]);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Short Duration</h3>

      <div className="glass-card p-4">
        <div className="flex items-center gap-3 mb-6">
          <Clock size={18} className="text-primary" />
          <div className="font-medium">
            {selectedDuration || durationOptions[value]} seconds
          </div>
        </div>

        <div className="space-y-6">
          <input
            type="range"
            min="0"
            max="4"
            step="1"
            value={value}
            onChange={handleSliderChange}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />

          <div className="flex justify-between">
            {durationOptions.map((duration, index) => (
              <button
                key={duration}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all text-white ${
                  index === value
                    ? "bg-primary"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
                onClick={() => handleButtonClick(index)}
              >
                {duration}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DurationSlider;
