import { useRef, useState } from "react";

type RangeSliderProps = {
  min: number;
  max: number;
  start: number;
  end: number;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
};

export function RangeSlider({
  min,
  max,
  start,
  end,
  onStartChange,
  onEndChange,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const getValueFromX = (x: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = (x - rect.left) / rect.width;
    const value = min + percent * (max - min);
    return Math.max(min, Math.min(max, value));
  };

  const handlePointerDown = (
    e: React.PointerEvent,
    handle: "start" | "end"
  ) => {
    setDragging(handle);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;

    const newValue = getValueFromX(e.clientX);
    if (dragging === "start") {
      if (newValue < end) onStartChange(newValue);
    } else {
      if (newValue > start) onEndChange(newValue);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const startPercent = ((start - min) / (max - min)) * 100;
  const endPercent = ((end - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      className="range-slider-track"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        className="range-slider-selected"
        style={{
          left: `${startPercent}%`,
          width: `${endPercent - startPercent}%`,
        }}
      />
      <div
        className="range-slider-handle"
        style={{ left: `${startPercent}%` }}
        onPointerDown={(e) => handlePointerDown(e, "start")}
      />
      <div
        className="range-slider-handle"
        style={{ left: `${endPercent}%` }}
        onPointerDown={(e) => handlePointerDown(e, "end")}
      />
    </div>
  );
}
