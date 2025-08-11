import { useMemo, useState } from "react";
import { State } from "./api";
import { GridView } from "./components/GridView";
import { ListView } from "./components/ListView";
import { FeedView } from "./components/FeedView";
import { Navbar } from "./components/Navbar";
import { Filter, Sort, ViewMode } from "./types";

export type AppProps = {
  state: State;
};

export function App({ state }: AppProps) {
  const [viewMode, setViewMode] = useState<ViewMode>({ mode: "grid" });
  const [filter, setFilter] = useState<Filter>({ mode: "none" });
  const [sort, setSort] = useState<Sort>({ by: "mtime", desc: true });

  const videos = useMemo(() => {
    const videos =
      filter.mode === "with-tag"
        ? state.videos.filter((video) => video.tags.includes(filter.tag))
        : filter.mode === "tagless"
        ? state.videos.filter((video) => video.tags.length === 0)
        : state.videos;
    return videos.sort(
      (a, b) =>
        (sort.by === "mtime"
          ? a.mtime.secs_since_epoch - b.mtime.secs_since_epoch ||
            a.mtime.nanos_since_epoch - b.mtime.nanos_since_epoch
          : a.size - b.size) * (sort.desc ? -1 : 1)
    );
  }, [state, filter, sort]);

  const tags = useMemo(
    () =>
      Array.from(new Set(state.videos.flatMap((video) => video.tags))).sort(),
    [state]
  );

  return (
    <div>
      <Navbar
        viewMode={viewMode}
        onViewMode={setViewMode}
        filter={filter}
        onFilter={setFilter}
        sort={sort}
        onSort={setSort}
        tags={tags}
      />
      {viewMode.mode === "grid" ? (
        <GridView videos={videos} />
      ) : viewMode.mode === "list" ? (
        <ListView videos={videos} />
      ) : (
        <FeedView videos={videos} />
      )}
      <datalist id="tags">
        {tags.map((tag) => (
          <option value={tag} key={tag} />
        ))}
      </datalist>
      <span className="app-version">{state.version}</span>
    </div>
  );
}
