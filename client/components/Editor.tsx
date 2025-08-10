import { useEffect, useMemo, useRef, useState } from "react";
import { State, Video } from "../api";
import { getThumbnailUrl, getVideoUrl } from "../api";
import { Clip } from "./Clip";
import { Trimmer } from "./Trimmer";

export type ProjectState = {
  clips: {
    /** references `path` in `state.videos` */
    path: string;
    // in seconds
    start: number;
    end: number;
  }[];
  uninitialized?: boolean;
};

export type EditorProps = {
  state: State;
  tag: string;
};
export function Editor({ state, tag }: EditorProps) {
  const [projectState, setProjectState] = useState<ProjectState>({
    clips: [],
    uninitialized: true,
  });
  const [trimmingClip, setTrimmingClip] = useState<number | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});

  // For drag and drop
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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
    () => new Map(state.videos.map((v) => [v.path, v])),
    [state.videos]
  );

  const addClip = (video: Video) => {
    const duration = durations[video.path];
    if (duration === undefined) return;

    setProjectState((p) => ({
      ...p,
      clips: [...p.clips, { path: video.path, start: 0, end: duration }],
    }));
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
  };

  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;

    setProjectState((p) => {
      const newClips = [...p.clips];
      const draggedItemContent = newClips.splice(dragItem.current!, 1)[0];
      newClips.splice(dragOverItem.current!, 0, draggedItemContent);
      return { ...p, clips: newClips };
    });

    dragItem.current = null;
    dragOverItem.current = null;
  };

  if (trimmingClip !== null) {
    const clip = projectState.clips[trimmingClip];
    if (!clip) {
      setTrimmingClip(null);
      return null;
    }
    const video = videoMap.get(clip.path);
    const duration = durations[clip.path];

    if (!video || duration === undefined) {
      setTrimmingClip(null);
      return null;
    }

    const otherClips = projectState.clips.filter(
      (c, index) => c.path === clip.path && index !== trimmingClip
    );

    return (
      <Trimmer
        clip={clip}
        video={video}
        duration={duration}
        otherClips={otherClips}
        onUpdate={(newClip) => {
          setProjectState((p) => {
            const newClips = [...p.clips];
            newClips[trimmingClip] = newClip;
            return { ...p, clips: newClips };
          });
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
            <video
              src={getVideoUrl(video).toString()}
              poster={getThumbnailUrl(video).toString()}
              preload="metadata"
              muted
              onLoadedMetadata={(e) => {
                setDurations((d) => ({
                  ...d,
                  [video.path]: e.currentTarget.duration,
                }));
              }}
            />
            {projectState.clips.some((c) => c.path === video.path) && (
              <div className="used-indicator" />
            )}
          </div>
        ))}
      </div>
      <div className="timeline" onDrop={handleDrop}>
        {projectState.clips.length === 0 && (
          <div className="timeline-placeholder">Timeline</div>
        )}
        {projectState.clips.map((clip, index) => {
          const video = videoMap.get(clip.path);
          if (!video) return null;
          return (
            <Clip
              key={index} // Not ideal, but fine for this scope. A unique ID per clip would be better.
              clip={clip}
              video={video}
              onClick={() => setTrimmingClip(index)}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDrop}
              onDrop={handleDrop}
            />
          );
        })}
      </div>
    </div>
  );
}
