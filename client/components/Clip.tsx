import { getThumbnailUrl, Video } from "../api";
import { ProjectState } from "./Editor";

type ClipProps = {
  clip: ProjectState["clips"][0];
  video: Video;
  onClick: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: () => void;
};

export function Clip({
  clip,
  video,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ClipProps) {
  const duration = clip.end - clip.start;
  return (
    <div
      className="clip-item"
      onClick={onClick}
      draggable={true}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      <img
        className="clip-thumbnail"
        src={getThumbnailUrl(video).toString()}
      />
      <div className="clip-info">
        <div className="clip-time">
          {clip.start.toFixed(2)}s - {clip.end.toFixed(2)}s
        </div>
        <div className="clip-duration">{duration.toFixed(2)}s</div>
      </div>
    </div>
  );
}
