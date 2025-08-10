import { getThumbnailUrl, Video } from "../api";
import { Clip } from "../types";

type ClipProps = {
  ends: [canLeft: boolean, canRight: boolean];
  clip: Clip;
  video: Video;
  onClick: () => void;
  onMove: (clipId: string, direction: "left" | "right" | "del") => void;
};

export function Clip({ ends, clip, video, onClick, onMove }: ClipProps) {
  return (
    <div className="clip-item">
      <div className="clip-thumbnail-wrapper" onClick={onClick}>
        <img
          className="clip-thumbnail"
          src={getThumbnailUrl(video).toString()}
        />
      </div>
      <div className="clip-actions">
        <button onClick={() => onMove(clip.id, "left")} disabled={!ends[0]}>
          &lt;
        </button>
        <button onClick={() => onMove(clip.id, "del")}>🗑️</button>
        <button onClick={() => onMove(clip.id, "right")} disabled={!ends[1]}>
          &gt;
        </button>
      </div>
    </div>
  );
}
