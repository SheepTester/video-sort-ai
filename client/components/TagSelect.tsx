import { useMemo, useState } from "react";
import { State } from "../api";
import { Editor } from "./Editor";

export type EditAppProps = {
  state: State;
};
export function TagSelect({ state }: EditAppProps) {
  const [tag, setTag] = useState<string | null>(null);

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

  if (!tag) {
    return (
      <div className="select-tag">
        <p>Select a tag</p>
        {tags.map(([tag, count]) => (
          <button key={tag} onClick={() => setTag(tag)}>
            <span>{tag}</span> <span>({count})</span>
          </button>
        ))}
      </div>
    );
  }

  return <Editor state={state} tag={tag} />;
}
