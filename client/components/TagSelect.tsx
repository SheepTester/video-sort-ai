import { useMemo } from "react";
import { deleteVideosByTag, renameTag, State } from "../api";
import { useSetState } from "../contexts/state";
import { extractFilename } from "../util";

export type TagSelectProps = {
  state: State;
};
export function TagSelect({ state }: TagSelectProps) {
  const setState = useSetState();

  const tags = useMemo(() => {
    const tags: Record<string, number> = {};
    for (const video of state.videos) {
      for (const tag of video.tags) {
        tags[tag] ??= 0;
        tags[tag]++;
      }
    }
    return Object.entries(tags).sort((a, b) => a[0].localeCompare(b[0]));
  }, [state]);

  return (
    <div className="select-tag">
      <p>
        Select a tag. <a href="/">Manage</a>
      </p>
      {tags.map(([tag, count]) => (
        <div key={tag}>
          <div>
            <a href={"?" + new URLSearchParams({ edit: "", tag })}>{tag}</a>{" "}
            <span>({count})</span>
          </div>
          <div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  state.videos
                    .filter((video) => video.tags.includes(tag))
                    .map((video) => extractFilename(video.path))
                    .join(" ")
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
                    `are you sure you want to delete all ${count} videos under ${tag}?`
                  )
                ) {
                  deleteVideosByTag(tag).then(setState);
                }
              }}
              className="dangerous"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
