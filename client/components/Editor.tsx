import {
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  cook,
  createPreviewList,
  getPreviewUrl,
  isTransposed,
  Size,
  State,
  Video,
} from "../api";
import { getThumbnailUrl } from "../api";
import { Clip as ClipComponent } from "./Clip";
import { Trimmer } from "./Trimmer";
import { ProjectState, Clip } from "../types";
import { useSetState } from "../contexts/state";
import { formatHms, formatMmSs, rotToAngle } from "../util";
import { CookModal } from "./CookModal";

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
  const [cookStatus, setCookStatus] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const wakeLockRef = useRef<Promise<WakeLockSentinel>>(null);
  const [speedUp, setSpeedUp] = useState(false);
  const pointerId = useRef<number | null>(null);
  const [showCook, setShowCook] = useState(false);

  useEffect(() => {
    if (loading) {
      if (!wakeLockRef.current) {
        wakeLockRef.current = navigator.wakeLock.request("screen");
      }
    } else if (wakeLockRef.current) {
      wakeLockRef.current.then((wakeLock) => {
        if (!wakeLock.released) return wakeLock.release();
      });
      wakeLockRef.current = null;
    }
  }, [loading]);

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
    () =>
      state.videos
        .filter((video) => video.tags.includes(tag))
        .sort(
          (a, b) =>
            a.mtime.secs_since_epoch - b.mtime.secs_since_epoch ||
            a.mtime.nanos_since_epoch - b.mtime.nanos_since_epoch
        ),
    [state, tag]
  );

  // auto load probes
  const needProbe = videos.some((video) => !video.probe);
  useEffect(() => {
    if (!loading && needProbe) {
      setLoading(true);
      setCookStatus("");
      createPreviewList(tag)
        .then(setState)
        .finally(() => setLoading(false));
    }
  }, [needProbe, loading]);

  const videoMap = useMemo(
    () =>
      Object.fromEntries(
        state.videos.map((video) => [video.thumbnail_name, video])
      ),
    [state.videos]
  );

  const sizes = useMemo(() => {
    const sizes: Record<SizeStr, Video[]> = {};
    for (const clip of projectState.clips) {
      const video = videoMap[clip.thumb];
      const origRot = video.probe?.rotation ?? "Unrotated";
      const clipRot = clip.overrideRotation ?? origRot;
      const { width: original_width = 0, height: original_height = 0 } =
        video.probe ?? {};
      const size: SizeStr =
        isTransposed(origRot) === isTransposed(clipRot)
          ? `${original_width}x${original_height}`
          : `${original_height}x${original_width}`;
      sizes[size] ??= [];
      sizes[size].push(video);
    }
    return Object.entries(sizes)
      .map(([size, videos]): [string, Set<Video>] => [size, new Set(videos)])
      .sort((a, b) => b[1].size - a[1].size);
  }, [videos, projectState.clips]);

  const currentClip = trimmingClip ?? lastTrimmingClip;
  const clip =
    currentClip !== null
      ? projectState.clips.find((clip) => clip.id === currentClip) ?? null
      : null;
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

  const totalDuration = useMemo(
    () =>
      projectState.clips.reduce((cum, curr) => cum + curr.end - curr.start, 0),
    [projectState.clips]
  );

  useEffect(() => {
    if (time >= totalDuration) {
      setPlaying(false);
      setTime(totalDuration);
    }
  }, [time, totalDuration]);

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

  const lastPlayingVideo = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = viewingClip && videoRefs.current[viewingClip.clip.thumb];
    if (!video || !viewingClip) return;

    const handleTimeUpdate = () => {
      if (lastPlayingVideo.current !== video) return;
      setTime(t + video.currentTime - viewingClip.clip.start);
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleTimeUpdate);

    const targetTime = time - t + viewingClip.clip.start;
    if (Math.abs(video.currentTime - targetTime) > 0.2) {
      video.currentTime = targetTime;
    }
    if (lastPlayingVideo.current && lastPlayingVideo.current !== video) {
      lastPlayingVideo.current.pause();
      console.log("pause old");
    }
    lastPlayingVideo.current = video;
    if (playing) {
      if (video.paused) {
        video.play();
      }
    } else {
      if (!video.paused) {
        video.pause();
        console.log("pause because pause");
      }
    }
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleTimeUpdate);
    };
  }, [playing, viewingClip]);

  const handlePointerEnd = (e: PointerEvent) => {
    if (pointerId.current === e.pointerId) {
      Object.values(videoRefs.current).forEach(
        (video) => (video.playbackRate = 1)
      );
      pointerId.current = null;
      setSpeedUp(false);
    }
  };

  return (
    <div className="editor-container">
      <Trimmer
        clip={clip}
        video={clip ? videoMap[clip.thumb] : null}
        duration={clip ? videoMap[clip.thumb].probe?.duration ?? 0 : 0}
        otherClips={otherClips}
        onUpdate={handleUpdate}
        open={trimmingClip !== null}
        onClose={handleClose}
      />
      <CookModal
        videos={videos}
        sizes={sizes}
        open={showCook}
        onClose={() => setShowCook(false)}
        onCook={async (encoding) => {
          setLoading(true);
          setCookStatus("Getting ready to cook...");
          try {
            for await (const status of cook(
              projectState.clips.map(
                ({ start, end, thumb, overrideRotation }) => ({
                  start,
                  end,
                  thumbnail_name: thumb,
                  override_rotation: overrideRotation ?? null,
                })
              ),
              encoding,
              `video-sort-${tag}`
            )) {
              setCookStatus(
                `total=${formatHms(totalDuration)}${status
                  .trim()
                  .replace(/\b(?=\w+=)/g, "\n")}`
              );
            }
            alert(
              `Successfully saved to video-sort-${tag}.mp4 in your Downloads folder.`
            );
          } finally {
            setLoading(false);
          }
        }}
      />
      <header>
        <a href="/?edit">&lt; back</a> {tag}
        <button onClick={() => setShowCook(true)}>Cook! 🧑‍🍳</button>
        <span className="version">{state.version}</span>
      </header>
      <div className="preview-area">
        <div className="preview-placeholder">
          {videos.map((video) => {
            let rotate = 0;
            if (viewingClip?.clip.thumb === video.thumbnail_name) {
              const origRot = video.probe?.rotation ?? "Unrotated";
              const clipRot = viewingClip.clip.overrideRotation ?? origRot;
              rotate = rotToAngle[origRot] - rotToAngle[clipRot];
            }
            return (
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
                  ...(rotate !== 0
                    ? {
                        transform: `rotate(${rotate}deg)`,
                        height: "auto",
                        aspectRatio: "1 / 1",
                      }
                    : {}),
                }}
              />
            );
          })}
        </div>
        <div className="vidcontrols">
          <button
            onClick={() => {
              setPlaying(!playing);
              if (!playing && time >= totalDuration) {
                setTime(0);
              }
            }}
          >
            {playing ? "⏸️" : "▶️"}
          </button>
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={time}
            onChange={(e) => {
              setTime(e.currentTarget.valueAsNumber);
              setPlaying(false);
            }}
            step="any"
          />
          <span className="time-display">
            {formatMmSs(time)} / {formatMmSs(totalDuration)}
          </span>
          <button
            className={`speed ${speedUp ? "sped-up" : ""}`}
            onPointerDown={(e) => {
              if (pointerId.current === null && lastPlayingVideo.current) {
                Object.values(videoRefs.current).forEach(
                  (video) => (video.playbackRate = 2)
                );
                pointerId.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                setSpeedUp(true);
              }
            }}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            &gt;&gt;
          </button>
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
              if (video.probe) {
                const duration = video.probe.duration;
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
            disabled={!video.probe}
          >
            <img src={getThumbnailUrl(video).toString()} />
            {projectState.clips.some(
              (c) => c.thumb === video.thumbnail_name
            ) && <div className="used-indicator">✅</div>}
            {!video.probe && <div className="unavail-indicator">⛔</div>}
          </button>
        ))}
      </div>
      <pre className={`cook-status ${loading ? "cook-status-visible" : ""}`}>
        <div className="spinner" />
        {cookStatus}
      </pre>
    </div>
  );
}
