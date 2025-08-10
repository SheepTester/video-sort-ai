import { useEffect, useMemo, useState } from "react";
import { State, Video } from "../api";
import { getThumbnailUrl } from "../api";
import { Clip as ClipComponent } from "./Clip";
import { Trimmer } from "./Trimmer";
import { ProjectState, Clip } from "../types";

export type EditorProps = {
  state: State;
  tag: string;
};
export function Editor({ state, tag }: EditorProps) {
  const [projectState, setProjectState] = useState<ProjectState>({
    clips: [],
    uninitialized: true,
  });
  const [trimmingClip, setTrimmingClip] = useState<Clip | null>(null);

  useEffect(() => {
    const project = localStorage.getItem(`video-sort/project/${tag}`);
    setProjectState(project ? JSON.parse(project) : { clips: [] });
  }, [tag]);

  useEffect(() => {
    if (!projectState.uninitialized) {
      localStorage.setItem(
        `video-sort/project/${tag}`,
        JSON.stringify(projectState)
      );
    }
  }, [projectState]);

  const videos = useMemo(
    () => state.videos.filter((video) => video.tags.includes(tag)),
    [state, tag]
  );

  const videoMap: Record<string, Video> = useMemo(
    () =>
      Object.fromEntries(state.videos.map((video) => [video.path, video])),
    [state.videos]
  );

  const addClip = (video: Video) => {
    setProjectState((p) => ({
      ...p,
      clips: [
        ...p.clips,
        {
          id: crypto.randomUUID(),
          path: video.path,
          start: 0,
          end: video.original_duration,
        },
      ],
    }));
  };

  const moveClip = (clipId: string, direction: "left" | "right") => {
    setProjectState((p) => {
      const clips = [...p.clips];
      const index = clips.findIndex((c) => c.id === clipId);
      if (index === -1) return p;

      const newIndex = direction === "left" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= clips.length) return p;

      const [movedClip] = clips.splice(index, 1);
      clips.splice(newIndex, 0, movedClip);
      return { ...p, clips };
    });
  };

  if (trimmingClip) {
    const video = videoMap[trimmingClip.path];
    return (
      <Trimmer
        clip={trimmingClip}
        video={video}
        otherClips={projectState.clips.filter(
          (c) => c.path === trimmingClip.path && c.id !== trimmingClip.id
        )}
        onUpdate={(newClip) => {
          setProjectState((p) => ({
            ...p,
            clips: p.clips.map((c) => (c.id === newClip.id ? newClip : c)),
          }));
        }}
        onClose={() => setTrimmingClip(null)}
      />
    );
  }

  return (
    <div className="editor-container">
      <div className="preview-area">
        <div className="preview-placeholder">Preview</div>
      </div>
      <div className="palette">
        {videos.map((video) => (
          <div
            key={video.path}
            className="palette-item"
            onClick={() => addClip(video)}
          >
            <img src={getThumbnailUrl(video).toString()} />
            {projectState.clips.some((c) => c.path === video.path) && (
              <div className="used-indicator" />
            )}
          </div>
        ))}
      </div>
      <div className="timeline">
        {projectState.clips.length === 0 && (
          <div className="timeline-placeholder">Timeline</div>
        )}
        {projectState.clips.map((clip) => {
          const video = videoMap[clip.path];
          return (
            <ClipComponent
              key={clip.id}
              clip={clip}
              video={video}
              onClick={() => setTrimmingClip(clip)}
              onMove={moveClip}
            />
          );
        })}
      </div>
    </div>
  );
}
