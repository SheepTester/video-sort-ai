import { useState, useEffect, useCallback } from "react";
import { State, getList, Video } from "./api";
import { VideoModal } from "./components/VideoModal";
import { SetStateContext } from "./contexts/state";
import { VideoContextProvider } from "./contexts/video";
import { App } from "./App";
import { TagSelect } from "./components/TagSelect";
import { Editor } from "./components/Editor";

type AppMode = { type: "app" } | { type: "edit"; tag: string | null };

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

  const [appMode, setAppMode] = useState<AppMode>({ type: "app" });

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setAppMode(
      params.get("edit") !== null
        ? { type: "edit", tag: params.get("tag") }
        : { type: "app" }
    );
  }, []);

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoThumb, setVideoThumb] = useState("");
  const showVideo = useCallback((video: Video) => {
    setVideoOpen(true);
    setVideoThumb(video.thumbnail_name);
  }, []);

  if (!state) {
    return null;
  }

  return (
    <SetStateContext.Provider value={setState}>
      <VideoContextProvider value={showVideo}>
        {appMode.type === "app" ? (
          <App state={state} />
        ) : appMode.tag === null ? (
          <TagSelect state={state} />
        ) : (
          <Editor state={state} tag={appMode.tag} />
        )}
        <VideoModal
          open={videoOpen}
          onClose={() => setVideoOpen(false)}
          video={
            state.videos.find((video) => video.thumbnail_name === videoThumb) ??
            null
          }
        />
        {errors.length > 0 && (
          <pre>{errors.map((error) => error.stack).join("\n\n")}</pre>
        )}
      </VideoContextProvider>
    </SetStateContext.Provider>
  );
}
