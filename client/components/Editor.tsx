import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPreviewList, getPreviewUrl, State } from "../api";
import { getThumbnailUrl } from "../api";
import { Clip as ClipComponent } from "./Clip";
import { Trimmer } from "./Trimmer";
import { ProjectState, Clip } from "../types";
import { useSetState } from "../contexts/state";

export type EditorProps = {
  state: State;
  tag: string;
};
export function Editor({ state, tag }: EditorProps) {
  const [projectState, setProjectState] = useState<ProjectState>({
    clips: [],
    uninitialized: true,
  });
  const [trimmingClip, setTrimmingClip] = useState<string | null>(null);
  const [lastTrimmingClip, setLastTrimmingClip] = useState<string | null>(null);
  const setState = useSetState();
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});

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

  const videoMap = useMemo(
    () => Object.fromEntries(state.videos.map((video) => [video.path, video])),
    [state.videos]
  );

  const currentClip = trimmingClip ?? lastTrimmingClip;
  const clip =
    currentClip !== null &&
    projectState.clips.find((clip) => clip.id === currentClip);
  let trimmerModal;
  const otherClips = useMemo(
    () =>
      projectState.clips.filter(
        (c) => clip && c.path === clip.path && c.id !== clip.id
      ),
    [projectState, clip]
  );
  const handleUpdate = useCallback((newClip: Clip) => {
    setProjectState((p) => ({
      ...p,
      clips: p.clips.map((c) => (c.id === newClip.id ? newClip : c)),
    }));
  }, []);
  const handleClose = useCallback(() => setTrimmingClip(null), []);
  if (clip && videoMap[clip.path].preview) {
    trimmerModal = (
      <Trimmer
        clip={clip}
        video={videoMap[clip.path]}
        duration={videoMap[clip.path].preview?.original_duration ?? 0}
        otherClips={otherClips}
        onUpdate={handleUpdate}
        open={trimmingClip !== null}
        onClose={handleClose}
      />
    );
  }

  let t = 0;
  let viewingClip: { offset: number; clip: Clip } | null = null;
  for (const clip of projectState.clips) {
    const duration = clip.end - clip.start;
    if (time - t < duration) {
      viewingClip = { offset: t, clip };
      break;
    }
    t += duration;
  }

  return (
    <div className="editor-container">
      {trimmerModal}
      <div className="preview-area">
        <div className="preview-placeholder">
          {videos.map((video) => (
            <video
              preload="none"
              src={getPreviewUrl(video).toString()}
              poster={getThumbnailUrl(video).toString()}
              key={video.path}
              ref={(elem) => {
                if (elem) videoRefs.current[video.path] = elem;
              }}
              style={{
                visibility:
                  viewingClip?.clip.path === video.path ? "visible" : "hidden",
              }}
            />
          ))}
        </div>
        <div className="vidcontrols">
          <button onClick={() => setPlaying((p) => !p)}>
            {playing ? "⏸️" : "▶️"}
          </button>
          <input
            type="range"
            min={0}
            max={projectState.clips.reduce(
              (cum, curr) => cum + curr.end - curr.start,
              0
            )}
            value={time}
            onChange={(e) => {
              setTime(e.currentTarget.valueAsNumber);
              setPlaying(false);
            }}
            step="any"
          />
        </div>
      </div>
      <div className="timeline">
        {projectState.clips.map((clip, i) => {
          const video = videoMap[clip.path];
          return (
            <ClipComponent
              key={clip.id}
              ends={[i > 0, i < projectState.clips.length - 1]}
              clip={clip}
              video={video}
              onClick={() => {
                setTrimmingClip(clip.id);
                setLastTrimmingClip(clip.id);
              }}
              onMove={(clipId, direction) => {
                if (direction === "del" && !confirm("delete clip?")) return;
                setProjectState((p) => {
                  if (direction === "del") {
                    return {
                      ...p,
                      clips: p.clips.filter((c) => c.id !== clip.id),
                    };
                  }

                  const index = p.clips.findIndex((c) => c.id === clipId);
                  if (index === -1) return p;

                  const newIndex = direction === "left" ? index - 1 : index + 1;
                  if (newIndex < 0 || newIndex >= p.clips.length) return p;

                  return {
                    ...p,
                    clips: p.clips
                      .with(index, p.clips[newIndex])
                      .with(newIndex, p.clips[index]),
                  };
                });
              }}
            />
          );
        })}
      </div>
      <div className="palette">
        {videos.map((video) => (
          <button
            key={video.path}
            className="palette-item"
            onClick={() => {
              if (video.preview) {
                const duration = video.preview.original_duration;
                setProjectState((p) => ({
                  ...p,
                  clips: [
                    ...p.clips,
                    {
                      id: crypto.randomUUID(),
                      path: video.path,
                      start: 0,
                      end: duration,
                    },
                  ],
                }));
              }
            }}
            disabled={!video.preview}
          >
            <img src={getThumbnailUrl(video).toString()} />
            {projectState.clips.some((c) => c.path === video.path) && (
              <div className="used-indicator">✅</div>
            )}
            {!video.preview && <div className="unavail-indicator">⛔</div>}
          </button>
        ))}
        <button
          onClick={() => {
            setLoading(true);
            createPreviewList(tag)
              .then(setState)
              .finally(() => setLoading(false));
          }}
          className="prepare-btn"
          disabled={videos.every((video) => video.preview) || loading}
        >
          Prepare previews
        </button>
      </div>
    </div>
  );
}
