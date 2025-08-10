import { useMemo } from "react";
import { State } from "../api";

export type TagSelectProps = {
  state: State;
};
export function TagSelect({ state }: TagSelectProps) {
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
      <p>Select a tag</p>
      {tags.map(([tag, count]) => (
        <a key={tag} href={"?" + new URLSearchParams({ edit: "", tag })}>
          <span>{tag}</span> <span>({count})</span>
        </a>
      ))}
    </div>
  );
}
