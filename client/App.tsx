import { useCallback, useEffect, useMemo, useState } from "react";
import { getList, State, Video } from "./api";
import { GridView } from "./components/GridView";
import { ListView } from "./components/ListView";
import { FeedView } from "./components/FeedView";
import { Navbar } from "./components/Navbar";
import { SetStateContext } from "./contexts/state";
import { VideoContextProvider } from "./contexts/video";
import { VideoModal } from "./components/VideoModal";

export type ViewMode =
  | { mode: "list" }
  | { mode: "feed" }
  | { mode: "grid"; columns: 2 | 3 | 4 | 5 };

type AppInnerProps = {
  state: State;
};

function AppInner({ state }: AppInnerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>({
    mode: "grid",
    columns: 5,
  });

  const videos = state.videos.toReversed();
  const tags = useMemo(
    () =>
      Array.from(new Set(state.videos.flatMap((video) => video.tags))).sort(),
    [state]
  );

  return (
    <div>
      <Navbar viewMode={viewMode} setViewMode={setViewMode} />
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
