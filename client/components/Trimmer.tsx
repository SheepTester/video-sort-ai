import { memo, useEffect, useRef } from "react";
import { Video } from "../api";
import { Clip } from "../types";
import { RangeSlider } from "./RangeSlider";
import { formatSeconds } from "../util";
import { Video as VideoComp } from "./Video";

type TrimmerProps = {
  clip: Clip;
  video: Video;
  duration: number;
  otherClips: Clip[];
  onUpdate: (newClip: Clip) => void;
  open: boolean;
  onClose: () => void;
};

function Trimmer_({
  clip,
  video,
  duration,
  otherClips,
  onUpdate,
  open,
  onClose,
}: TrimmerProps) {
  console.log("trimmer render");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      if (videoRef.current) {
        videoRef.current.currentTime = clip.start;
        videoRef.current.play();
      }
    } else {
      dialogRef.current?.close();
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.ontimeupdate = null;
      }
    }
  }, [open]);

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
          videoEl.ontimeupdate = null;
        }
      };
      videoEl.ontimeupdate = stopPlayback;
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="modal trimmer-container"
    >
      <form method="dialog" className="trimmer-header">
        <button onClick={onClose} type="submit">
          &lt; Back
        </button>
        <h3>Trim Clip</h3>
      </form>
      <div className="trimmer-preview">
        <VideoComp video={video} videoRef={videoRef} preview />
      </div>
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
          <div className="time-adjust">
            <button onClick={() => changeTime("end", -1 / 60)}>-1/60</button>
            <span>End</span>
            <button onClick={() => changeTime("end", 1 / 60)}>+1/60</button>
          </div>
        </div>
        <div className="preview-actions">
          <button onClick={() => preview("start")}>Play from Start</button>
          <button onClick={() => preview("end")}>Play near End</button>
        </div>
        <div className="trimmer-info">
          Original Duration: {formatSeconds(duration)}
        </div>
      </div>
    </dialog>
  );
}

export const Trimmer = memo(Trimmer_);
