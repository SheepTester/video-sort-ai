import { FormEvent, useState } from "react";
import { getThumbnailUrl, setNote, Video } from "../api";
import { useSetState } from "../state";

function extractFilename(path: string) {
  return path.split("/").pop() || path;
}

type ListItemProps = {
  video: Video;
};

export function ListItem({ video }: ListItemProps) {
  const setState = useSetState();
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveNote = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get("note"));
    setNote(video, note).then((newState) => {
      setState(newState);
      setIsEditing(false);
    });
  };

  const handleCopyFilename = async () => {
    await navigator.clipboard.writeText(extractFilename(video.path));
  };

  return (
    <div className="list-item">
      <div className="list-item-thumbnail">
        <img
          src={getThumbnailUrl(video).toString()}
          alt={video.path}
          loading="lazy"
        />
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
            <form onSubmit={handleSaveNote}>
              <input
                type="text"
                name="note"
                defaultValue={video.note}
                autoFocus
              />
              <button type="submit">Save</button>
              <button type="button" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <p>{video.note || <em>No note.</em>}</p>
              <button onClick={() => setIsEditing(true)}>Edit Note</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
