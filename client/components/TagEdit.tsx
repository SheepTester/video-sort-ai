import { addTag, removeTag, Video } from "../api";
import { useSetState } from "../contexts/state";

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
      </form>
    </div>
  );
}
