import { useCallback, useEffect, useMemo, useState } from "react";
import { getList, State, Video } from "./api";
import { GridView } from "./components/GridView";
import { ListView } from "./components/ListView";
import { FeedView } from "./components/FeedView";
import { Navbar } from "./components/Navbar";
import { SetStateContext } from "./contexts/state";
import { VideoContextProvider } from "./contexts/video";
import { VideoModal } from "./components/VideoModal";
import { Filter, ViewMode } from "./types";

type AppInnerProps = {
  state: State;
};

function AppInner({ state }: AppInnerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>({
    mode: "grid",
    columns: 5,
  });
  const [filter, setFilter] = useState<Filter>({ mode: "none" });

  const videos = (
    filter.mode === "with-tag"
      ? state.videos.filter((video) => video.tags.includes(filter.tag))
      : filter.mode === "tagless"
      ? state.videos.filter((video) => video.tags.length === 0)
      : state.videos
  ).toReversed();
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
        tags={tags}
      />
      {viewMode.mode === "grid" ? (
        <GridView columns={viewMode.columns} videos={videos} />
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
  useEffect(() => {
    getList().then(setState);
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
      </VideoContextProvider>
    </SetStateContext.Provider>
  );
}
