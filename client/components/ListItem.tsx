import { FormEvent, useState } from "react";
import { deleteVideo, getThumbnailUrl, setNote, Video } from "../api";
import { useSetState } from "../contexts/state";
import { useVideoContext } from "../contexts/video";
import { extractFilename, formatSize } from "../util";
import { TagEdit } from "./TagEdit";

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
    await navigator.clipboard.writeText(extractFilename(video));
  };

  return (
    <div className="list-item">
      <button className="list-item-thumbnail" onClick={() => showVideo(video)}>
        <img
          src={getThumbnailUrl(video).toString()}
          alt={extractFilename(video)}
          loading="lazy"
        />
      </button>
      <div className="list-item-info">
        <div className="list-item-filename">
          <span>
            {extractFilename(video).replace(".mp4", "") + " "}
            <button
              onClick={() => {
                if (confirm(`delete ${extractFilename(video)} fr?`)) {
                  deleteVideo(video).then(setState);
                }
              }}
              className="deletebtn"
            >
              Delete
            </button>
          </span>
          <button onClick={handleCopyFilename}>📋</button>
        </div>
        <div className="time">
          {fmt.format(video.mtime.secs_since_epoch * 1000)} &middot;{" "}
          {formatSize(video.size)}
        </div>
        <TagEdit video={video} hideSize />
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
