import { FormEvent, useState } from "react";
import {
  deleteVideo,
  getThumbnailUrl,
  removeTag,
  setNote,
  Video,
} from "../api";
import { useSetState } from "../contexts/state";
import { useVideoContext } from "../contexts/video";
import { TagEdit } from "./TagEdit";

function extractFilename(path: string) {
  return path.split("/").pop() || path;
}

const fmt = new Intl.DateTimeFormat([], {
  dateStyle: "long",
  timeStyle: "medium",
});

type ListItemProps = {
  video: Video;
};

export function ListItem({ video }: ListItemProps) {
  const showVideo = useVideoContext();

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
      <button className="list-item-thumbnail" onClick={() => showVideo(video)}>
        <img
          src={getThumbnailUrl(video).toString()}
          alt={video.path}
          loading="lazy"
        />
      </button>
      <div className="list-item-info">
        <div className="list-item-filename">
          <span>{extractFilename(video.path)}</span>
          <button onClick={handleCopyFilename}>Copy</button>
        </div>
        <div className="time">
          {fmt.format(video.mtime.secs_since_epoch * 1000)}
          <button
            onClick={() => {
              if (confirm(`delete ${extractFilename(video.path)} fr?`)) {
                deleteVideo(video).then(setState);
              }
            }}
            className="deletebtn"
          >
            Delete
          </button>
        </div>
        <TagEdit video={video} />
        {/* <div className="list-item-note">
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
            <p>
              {video.note || <em>No note.</em>}
              <button onClick={() => setIsEditing(true)}>Edit</button>
            </p>
          )}
        </div> */}
      </div>
    </div>
  );
}
