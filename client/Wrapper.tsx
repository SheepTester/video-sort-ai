import { useState, useEffect, useCallback } from "react";
import { State, getList, Video } from "./api";
import { VideoModal } from "./components/VideoModal";
import { SetStateContext } from "./contexts/state";
import { VideoContextProvider } from "./contexts/video";
import { App } from "./App";
import { EditApp } from "./EditApp";

export function Wrapper() {
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

  const [appMode, setAppMode] = useState<"app" | "edit">("app");

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setAppMode(params.get("edit") !== null ? "edit" : "app");
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
        {appMode === "app" ? <App state={state} /> : <EditApp state={state} />}
        <VideoModal
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          video={state.videos.find((video) => video.path === videoPath) ?? null}
        />
        {errors.length > 0 && (
          <pre>{errors.map((error) => error.stack).join("\n\n")}</pre>
        )}
      </VideoContextProvider>
    </SetStateContext.Provider>
  );
}
