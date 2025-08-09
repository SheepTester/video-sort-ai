import { addTag, getVideoUrl, removeTag, Video } from "../api";
import { useSetState } from "../contexts/state";
import { formatSize } from "../util";

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
          if (!navigator.share) {
            alert("Web Share API is not supported in your browser.");
            return;
          }

          try {
            const videoUrl = getVideoUrl(video);
            const response = await fetch(videoUrl);
            const blob = await response.blob();
            const filename = video.path.split("/").pop() || "video.mp4";
            const file = new File([blob], filename, { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: video.path,
                text: "",
              });
            } else {
              alert("Sharing not supported for this file.");
            }
          } catch (error) {
            console.error("Error sharing file:", error);
            alert(`Error sharing file: ${error}`);
          }
        }}
      >
        📤
      </button>
      <div className="size">{formatSize(video.size)}</div>
    </div>
  );
}
