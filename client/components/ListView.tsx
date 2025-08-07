import { useState } from "react";
import { getThumbnailUrl, setNote, State, Video } from "../api";

type ListViewProps = {
  videos: Video[];
  onStateChange: (state: State) => void;
};

function ListItem({
  video,
  onStateChange,
}: {
  video: Video;
  onStateChange: (state: State) => void;
}) {
  const [note, setLocalNote] = useState(video.note || "");
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveNote = () => {
    setNote(video, note).then((newState) => {
      onStateChange(newState as State);
      setIsEditing(false);
    });
  };

  const extractFilename = (path: string) => {
    return path.split("/").pop() || path;
  };

  const handleCopyFilename = () => {
    navigator.clipboard.writeText(extractFilename(video.path));
  };

  return (
    <div className="list-item">
      <div className="list-item-thumbnail">
        <img src={getThumbnailUrl(video).toString()} alt={video.path} />
      </div>
      <div className="list-item-info">
        <div className="list-item-filename">
          <span>{extractFilename(video.path)}</span>
          <button onClick={handleCopyFilename}>Copy</button>
        </div>
        <div className="list-item-tags">
          {video.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="list-item-note">
          {isEditing ? (
            <>
              <textarea
                value={note}
                onChange={(e) => setLocalNote(e.target.value)}
              />
              <button onClick={handleSaveNote}>Save</button>
              <button onClick={() => setIsEditing(false)}>Cancel</button>
            </>
          ) : (
            <>
              <p>{video.note || "No note."}</p>
              <button onClick={() => setIsEditing(true)}>Edit Note</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ListView({ videos, onStateChange }: ListViewProps) {
  return (
    <div className="list-view">
      {videos.map((video) => (
        <ListItem
          key={video.path}
          video={video}
          onStateChange={onStateChange}
        />
      ))}
    </div>
  );
}
