import { addTag, getVideoUrl, removeTag, Video } from "../api";
import { useSetState } from "../contexts/state";
import { extractFilename, formatSize } from "../util";

export type TagEditProps = {
  video: Video;
  hideSize?: boolean;
};

export function TagEdit({ video, hideSize }: TagEditProps) {
  const setState = useSetState();

  return (
    <div className="tags">
      {video.tags.toSorted().map((tag) => (
        <div className="tag" key={tag} data-tag={tag}>
          {tag}
          <button title="Remove tag" onClick={() => removeTag(video, tag).then(setState)}>
            &times;
          </button>
        </div>
      ))}
      {video.tags.length === 0 ? (
        <>
          <button
            title="Add DEL tag"
            className="tag add-tag"
            data-tag="delete"
            onClick={() => addTag(video, "delete").then(setState)}
          >
            + DEL
          </button>
          <button
            title="Add YT tag"
            className="tag add-tag"
            data-tag="youtube"
            onClick={() => addTag(video, "youtube").then(setState)}
          >
            + YT
          </button>
        </>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const tag = String(new FormData(e.currentTarget).get("tag"));
          if (tag) {
            addTag(video, tag).then(setState);
          }
          e.currentTarget.reset();
        }}
      >
        <input name="tag" placeholder="add a tag" type="text" list="tags" />
        <button title="Add tag" type="submit">+</button>
      </form>
      {!hideSize && <div className="size">{formatSize(video.size)}</div>}
      <button
        title="Share"
        onClick={async () => {
          const res = await fetch(getVideoUrl(video));
          const blob = await res.blob();
          const name = extractFilename(video);
          const file = new File([blob], name, {
            type: blob.type,
          });
          await navigator.share({ files: [file], title: name });
        }}
        className="sharebtn"
      >
        📤
      </button>
    </div>
  );
}
