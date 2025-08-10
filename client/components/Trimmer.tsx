import { useEffect, useRef, useState } from "react";
import { getPreviewUrl, Video } from "../api";
import { ProjectState } from "./Editor";
import { RangeSlider } from "./RangeSlider";

type Clip = ProjectState["clips"][0];

type TrimmerProps = {
  clip: Clip;
  video: Video;
  duration: number; // original video duration
  otherClips: Clip[];
  onUpdate: (newClip: Clip) => void;
  onClose: () => void;
};

// A simple formatter for seconds
const formatTime = (time: number) => time.toFixed(2);

export function Trimmer({
  clip,
  video,
  duration,
  otherClips,
  onUpdate,
  onClose,
}: TrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localClip, setLocalClip] = useState(clip);

  useEffect(() => {
    // Propagate changes up after a short delay to avoid spamming updates
    const handler = setTimeout(() => onUpdate(localClip), 200);
    return () => clearTimeout(handler);
  }, [localClip, onUpdate]);

  const changeTime = (field: "start" | "end", delta: number) => {
    setLocalClip((c) => {
      const newValue = c[field] + delta;
      // Basic validation
      if (field === "start" && newValue >= c.end) return c;
      if (field === "end" && newValue <= c.start) return c;
      if (newValue < 0 || newValue > duration) return c;
      return { ...c, [field]: newValue };
    });
  };

  const preview = (type: "start" | "end") => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (type === "start") {
      videoEl.currentTime = localClip.start;
      videoEl.play();
    } else {
      videoEl.currentTime = Math.max(localClip.start, localClip.end - 0.5);
      videoEl.play();
      // Stop playback at the end time
      const stopPlayback = () => {
        if (videoEl.currentTime >= localClip.end) {
          videoEl.pause();
          videoEl.removeEventListener("timeupdate", stopPlayback);
        }
      };
      videoEl.addEventListener("timeupdate", stopPlayback);
    }
  };

  return (
    <div className="trimmer-container">
      <div className="trimmer-header">
        <button onClick={onClose}>&lt; Back</button>
        <h3>Trim Clip</h3>
      </div>
      <video
        ref={videoRef}
        className="trimmer-preview"
        src={getPreviewUrl(video).toString()}
        controls={false}
      />
      <div className="trimmer-controls">
        <div className="trimmer-info">
          <div>Start: {formatTime(localClip.start)}s</div>
          <div>End: {formatTime(localClip.end)}s</div>
          <div>Duration: {formatTime(localClip.end - localClip.start)}s</div>
        </div>

        <div className="range-slider-container">
          <RangeSlider
            min={0}
            max={duration}
            start={localClip.start}
            end={localClip.end}
            onStartChange={(newStart) =>
              setLocalClip((c) => ({ ...c, start: newStart }))
            }
            onEndChange={(newEnd) =>
              setLocalClip((c) => ({ ...c, end: newEnd }))
            }
          />
          <div className="other-clips-ranges">
            {otherClips.map((otherClip, i) => {
              const startPercent = (otherClip.start / duration) * 100;
              const widthPercent =
                ((otherClip.end - otherClip.start) / duration) * 100;
              return (
                <div
                  key={i}
                  className="other-clip-range"
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`,
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="trimmer-actions">
          <div className="time-adjust">
            <button onClick={() => changeTime("start", -1 / 60)}>-1/60</button>
            <span>Start</span>
            <button onClick={() => changeTime("start", 1 / 60)}>+1/60</button>
          </div>
          <div className="preview-actions">
            <button onClick={() => preview("start")}>Play from Start</button>
            <button onClick={() => preview("end")}>Play near End</button>
          </div>
          <div className="time-adjust">
            <button onClick={() => changeTime("end", -1 / 60)}>-1/60</button>
            <span>End</span>
            <button onClick={() => changeTime("end", 1 / 60)}>+1/60</button>
          </div>
        </div>
        <div className="trimmer-info">
          Original Duration: {formatTime(duration)}s
        </div>
      </div>
    </div>
  );
}
