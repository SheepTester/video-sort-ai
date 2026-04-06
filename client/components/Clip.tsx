import { getThumbnailUrl, Video } from "../api";
import { Clip } from "../types";
import { formatSeconds } from "../util";

type ClipProps = {
  ends: [canLeft: boolean, canRight: boolean];
  clip: Clip;
  video: Video;
  onClick: () => void;
  onMove: (clipId: string, direction: "left" | "right" | "del") => void;
};

export function Clip({ ends, clip, video, onClick, onMove }: ClipProps) {
  const rot = clip.overrideRotation ?? video.probe?.rotation ?? "Unrotated";
  return (
    <div className="clip-item">
      <div
        className="clip-thumbnail-wrapper"
        onClick={onClick}
        data-rot={
          rot === "Neg90"
            ? "↻"
            : rot === "Pos90"
            ? "↺"
            : rot === "Neg180"
            ? "🙃"
            : ""
        }
        data-dur={
          clip.start === 0 && clip.end === video.probe?.duration
            ? "Full"
            : formatSeconds(clip.end - clip.start)
        }
      >
        <img
          className="clip-thumbnail"
          src={getThumbnailUrl(video).toString()}
        />
      </div>
      <div className="clip-actions">
        <button title="Move left" onClick={() => onMove(clip.id, "left")} disabled={!ends[0]}>
          &lt;
        </button>
        <button title="Delete clip" onClick={() => onMove(clip.id, "del")}>🗑️</button>
        <button title="Move right" onClick={() => onMove(clip.id, "right")} disabled={!ends[1]}>
          &gt;
        </button>
      </div>
    </div>
  );
}
