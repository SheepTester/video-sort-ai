import { useCallback, useEffect, useMemo, useState } from "react";
import { getList, State, Video } from "./api";
import { GridView } from "./components/GridView";
import { ListView } from "./components/ListView";
import { FeedView } from "./components/FeedView";
import { Navbar } from "./components/Navbar";
import { SetStateContext } from "./contexts/state";
import { VideoContextProvider } from "./contexts/video";
import { VideoModal } from "./components/VideoModal";
import { Filter, Sort, ViewMode } from "./types";

type AppInnerProps = {
  state: State;
};

function AppInner({ state }: AppInnerProps) {
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
    </div>
  );
}

export function App() {
  const [state, setState] = useState<State | null>(null);
  const [errors, setErrors] = useState<Error[]>([]);
  useEffect(() => {
    getList().then(setState);
    const errorListener = (e: ErrorEvent) => {
      setErrors((errors) => [...errors, e.error]);
    };
    const rejectionListener = (e: PromiseRejectionEvent) => {
      setErrors((errors) => [...errors, e.reason]);
    };
    window.addEventListener("error", errorListener);
    window.addEventListener("unhandledrejection", rejectionListener);
    return () => {
      window.removeEventListener("error", errorListener);
      window.removeEventListener("unhandledrejection", rejectionListener);
    };
  }, []);

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoPath, setVideoPath] = useState("");
  const showVideo = useCallback((video: Video) => {
    setVideoOpen(true);
    setVideoPath(video.path);
  }, []);

  if (!state) {
    return null;
  }

  return (
    <SetStateContext.Provider value={setState}>
      <VideoContextProvider value={showVideo}>
        <AppInner state={state} />
        <VideoModal
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          video={state.videos.find((video) => video.path === videoPath) ?? null}
        />
        {errors.length > 0 && (
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "lightcoral",
              color: "black",
              padding: "1em",
              margin: 0,
              zIndex: 9999,
              maxHeight: "30vh",
              overflowY: "auto",
            }}
          >
            {errors.map((error, i) => (
              <pre key={i}>{error.stack}</pre>
            ))}
          </div>
        )}
      </VideoContextProvider>
    </SetStateContext.Provider>
  );
}
