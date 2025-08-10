import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cook, createPreviewList, getPreviewUrl, Size, State } from "../api";
import { getThumbnailUrl } from "../api";
import { Clip as ClipComponent } from "./Clip";
import { Trimmer } from "./Trimmer";
import { ProjectState, Clip } from "../types";
import { useSetState } from "../contexts/state";

type SizeStr = `${number}x${number}`;
function parseSize(size: string): Size {
  const [width, height] = size.split("x").map(Number);
  return { width, height };
}

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
    () =>
      Object.fromEntries(
        state.videos.map((video) => [video.thumbnail_name, video])
      ),
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
        (c) => clip && c.thumb === clip.thumb && c.id !== clip.id
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
  if (clip && videoMap[clip.thumb].preview) {
    trimmerModal = (
      <Trimmer
        clip={clip}
        video={videoMap[clip.thumb]}
        duration={videoMap[clip.thumb].preview?.original_duration ?? 0}
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

  const sizes = useMemo(() => {
    const maxSize = videos
      .filter((video) =>
        projectState.clips.some((clip) => clip.thumb === video.thumbnail_name)
      )
      .reduce(
        (a, b) => ({
          width: Math.max(a.width, b.preview?.original_width ?? 0),
          height: Math.max(a.height, b.preview?.original_height ?? 0),
        }),
        { width: 0, height: 0 }
      );
    return Array.from(
      new Set<SizeStr>([
        `${maxSize.width}x${maxSize.height}`,
        ...videos.flatMap((video): SizeStr[] =>
          video.preview
            ? [
                `${video.preview.original_width}x${video.preview.original_height}`,
              ]
            : []
        ),
      ])
    );
  }, [videos, projectState]);
  const [size, setSize] = useState<SizeStr>("0x0");

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
              key={video.thumbnail_name}
              ref={(elem) => {
                if (elem) videoRefs.current[video.thumbnail_name] = elem;
              }}
              style={{
                visibility:
                  viewingClip?.clip.thumb === video.thumbnail_name
                    ? "visible"
                    : "hidden",
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
          const video = videoMap[clip.thumb];
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
            key={video.thumbnail_name}
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
                      thumb: video.thumbnail_name,
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
            {projectState.clips.some(
              (c) => c.thumb === video.thumbnail_name
            ) && <div className="used-indicator">✅</div>}
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
        <select
          value={size}
          onChange={(e) => {
            const { width, height } = parseSize(e.currentTarget.value);
            setSize(`${width}x${height}`);
          }}
        >
          <option value="0x0" disabled>
            Select a size
          </option>
          {...sizes.map((size) => {
            const { width, height } = parseSize(size);
            return (
              <option key={size} value={size}>
                {width} &times; {height}
              </option>
            );
          })}
        </select>
        <button
          onClick={() => {
            setLoading(true);
            cook(
              projectState.clips.map(({ start, end, thumb }) => ({
                start,
                end,
                thumbnail_name: thumb,
              })),
              parseSize(size)
            )
              .then(setState)
              .finally(() => setLoading(false));
          }}
          className="prepare-btn"
          disabled={
            projectState.clips.length === 0 || loading || size === "0x0"
          }
        >
          Cook! 🧑‍🍳
        </button>
      </div>
    </div>
  );
}
