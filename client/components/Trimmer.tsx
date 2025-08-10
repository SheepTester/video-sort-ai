import { useEffect, useRef, useState } from "react";
import { getPreviewUrl, Video } from "../api";
import { Clip } from "../types";
import { RangeSlider } from "./RangeSlider";
import { formatSeconds } from "../util";

type TrimmerProps = {
  clip: Clip;
  video: Video;
  duration: number;
  otherClips: Clip[];
  onUpdate: (newClip: Clip) => void;
  onClose: () => void;
};

export function Trimmer({
  clip,
  video,
  duration,
  otherClips,
  onUpdate,
  onClose,
}: TrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const changeTime = (field: "start" | "end", delta: number) => {
    const newValue = clip[field] + delta;
    // Basic validation
    if (field === "start" && newValue >= clip.end) return;
    if (field === "end" && newValue <= clip.start) return;
    if (newValue < 0 || newValue > duration) return;

    onUpdate({ ...clip, [field]: newValue });
  };

  const preview = (type: "start" | "end") => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (type === "start") {
      videoEl.currentTime = clip.start;
      videoEl.play();
    } else {
      videoEl.currentTime = Math.max(clip.start, clip.end - 0.5);
      videoEl.play();
      // Stop playback at the end time
      const stopPlayback = () => {
        if (videoEl.currentTime >= clip.end) {
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
          <div>Start: {formatSeconds(clip.start)}</div>
          <div>End: {formatSeconds(clip.end)}</div>
          <div>Duration: {formatSeconds(clip.end - clip.start)}</div>
        </div>

        <div className="range-slider-container">
          <RangeSlider
            min={0}
            max={duration}
            start={clip.start}
            end={clip.end}
            onStartChange={(newStart) => onUpdate({ ...clip, start: newStart })}
            onEndChange={(newEnd) => onUpdate({ ...clip, end: newEnd })}
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
          Original Duration: {formatSeconds(duration)}
        </div>
      </div>
    </div>
  );
}
