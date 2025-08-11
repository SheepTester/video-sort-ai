import { CSSProperties, memo, useEffect, useRef } from "react";
import { Rotation, Video } from "../api";
import { Clip } from "../types";
import { RangeSlider } from "./RangeSlider";
import { formatSeconds, rotToAngle } from "../util";
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
    if (videoRef.current) videoRef.current.currentTime = newValue;
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
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const stopPlayback = () => {
      if (video.currentTime >= clip.end) {
        video.pause();
      }
    };
    video.addEventListener("timeupdate", stopPlayback);
    return () => {
      video.removeEventListener("timeupdate", stopPlayback);
    };
  }, [clip.end]);

  const origRot = video.probe?.rotation ?? "Unrotated";
  const clipRot = clip.overrideRotation ?? origRot;
  const previewRotAngle = rotToAngle[origRot] - rotToAngle[clipRot];

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
      <div
        className={`trimmer-preview ${previewRotAngle ? "has-rot" : ""}`}
        style={{ "--rot": `${previewRotAngle}deg` } as CSSProperties}
      >
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
            onStartChange={(newStart) => {
              onUpdate({ ...clip, start: newStart });
              if (videoRef.current) videoRef.current.currentTime = newStart;
            }}
            onEndChange={(newEnd) => {
              onUpdate({ ...clip, end: newEnd });
              if (videoRef.current) videoRef.current.currentTime = newEnd;
            }}
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
          <select
            value={clipRot}
            onChange={(e) => {
              const val = e.currentTarget.value;
              if (
                val === "Unrotated" ||
                val === "Neg90" ||
                val === "Pos90" ||
                val === "Neg180"
              ) {
                if (video.probe) {
                  onUpdate({
                    ...clip,
                    overrideRotation: val !== origRot ? val : undefined,
                  });
                }
              }
            }}
          >
            <option disabled>Rotate video data</option>
            <option value="Unrotated">Unrotated</option>
            <option value="Neg90">↻ 90&deg;</option>
            <option value="Pos90">↺ 90&deg;</option>
            <option value="Neg180">180&deg;</option>
          </select>
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
