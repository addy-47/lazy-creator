import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Slider } from "./ui/slider";

interface DurationSliderProps {
  selectedDuration: number;
  onDurationChange: (duration: number) => void;
}

const DurationSlider = ({
  selectedDuration,
  onDurationChange,
}: DurationSliderProps) => {
  const [value, setValue] = useState(20); // Default to 20 seconds

  useEffect(() => {
    if (!selectedDuration) {
      onDurationChange(20);
    } else {
      setValue(selectedDuration);
    }
  }, [selectedDuration, onDurationChange]);

  const handleSliderChange = (newValue: number[]) => {
    const duration = newValue[0];
    setValue(duration);
    onDurationChange(duration);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Short Duration</h3>

      <div className="flex items-center gap-3 mb-6">
        <Clock size={18} className="text-primary" />
        <div className="font-medium">{value} seconds</div>
      </div>

      <div className="space-y-6">
        <Slider
          value={[value]}
          min={10}
          max={30}
          step={1}
          onValueChange={handleSliderChange}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default DurationSlider;
