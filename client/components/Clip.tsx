import { getThumbnailUrl, Video } from "../api";
import { Clip } from "../types";

type ClipProps = {
  clip: Clip;
  video: Video;
  onClick: () => void;
  onMove: (clipId: string, direction: "left" | "right") => void;
};

export function Clip({ clip, video, onClick, onMove }: ClipProps) {
  return (
    <div className="clip-item">
      <div className="clip-thumbnail-wrapper" onClick={onClick}>
        <img
          className="clip-thumbnail"
          src={getThumbnailUrl(video).toString()}
        />
      </div>
      <div className="clip-actions">
        <button onClick={() => onMove(clip.id, "left")}>&lt;</button>
        <button onClick={() => onMove(clip.id, "right")}>&gt;</button>
      </div>
    </div>
  );
}
