import { addTag, getVideoUrl, removeTag, Video } from "../api";
import { useSetState } from "../contexts/state";
import { extractFilename, formatSize } from "../util";

export type TagEditProps = {
  video: Video;
};

export function TagEdit({ video }: TagEditProps) {
  const setState = useSetState();

  return (
    <div className="tags">
      {video.tags.toSorted().map((tag) => (
        <div className="tag" key={tag} data-tag={tag}>
          {tag}
          <button onClick={() => removeTag(video, tag).then(setState)}>
            &times;
          </button>
        </div>
      ))}
      {video.tags.length === 0 ? (
        <>
          <button
            className="tag add-tag"
            data-tag="delete"
            onClick={() => addTag(video, "delete").then(setState)}
          >
            + DEL
          </button>
          <button
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
        <button type="submit">+</button>
      </form>
      <button
        onClick={async () => {
          const res = await fetch(getVideoUrl(video));
          const blob = await res.blob();
          const name = extractFilename(video.path);
          const file = new File([blob], name, {
            type: blob.type,
          });
          await navigator.share({ files: [file], title: name });
        }}
      >
        📤
      </button>
      <div className="size">{formatSize(video.size)}</div>
    </div>
  );
}
