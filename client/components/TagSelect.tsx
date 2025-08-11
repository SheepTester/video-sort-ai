import { useMemo } from "react";
import { deleteVideosByTag, renameTag, State, Video } from "../api";
import { useSetState } from "../contexts/state";
import { extractFilename, formatSize } from "../util";

export type TagSelectProps = {
  state: State;
};
export function TagSelect({ state }: TagSelectProps) {
  const setState = useSetState();

  const tags = useMemo(() => {
    const tags: Record<string, Video[]> = {};
    for (const video of state.videos) {
      for (const tag of video.tags) {
        tags[tag] ??= [];
        tags[tag].push(video);
      }
    }
    return Object.entries(tags).sort((a, b) => a[0].localeCompare(b[0]));
  }, [state]);

  return (
    <div className="select-tag">
      <nav>
        Select a tag. <a href="/">Videos</a>{" "}
        <span className="version">{state.version}</span>
      </nav>
      {tags.map(([tag, videos]) => (
        <div key={tag}>
          <div>
            <a href={"?" + new URLSearchParams({ edit: "", tag })}>{tag}</a>{" "}
            <span>
              {videos.length} video{videos.length === 1 ? "" : "s"}
            </span>
          </div>
          <div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  videos.map((video) => extractFilename(video.path)).join(" ")
                );
              }}
            >
              Copy names
            </button>
            <button
              onClick={() => {
                const name = prompt(`new name for ${tag}:`);
                if (name) {
                  renameTag(tag, name).then(setState);
                }
              }}
            >
              Rename
            </button>
            <button
              onClick={() => {
                if (
                  confirm(
                    `are you sure you want to reset the project for ${tag}?`
                  )
                ) {
                  localStorage.removeItem(`video-sort/project/${tag}`);
                }
              }}
              className="dangerous"
            >
              Reset
            </button>
            <button
              onClick={() => {
                if (
                  confirm(
                    `are you sure you want to delete all ${videos.length} videos under ${tag}?`
                  )
                ) {
                  deleteVideosByTag(tag).then(setState);
                }
              }}
              className="dangerous"
            >
              Delete
            </button>
            <span className="tag-total-size">
              {formatSize(
                videos.reduce(
                  (cum, curr) => cum + curr.size + (curr.preview3?.size ?? 0),
                  0
                )
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
