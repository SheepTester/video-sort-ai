import { useCallback, useRef, useState } from "react";
import { getThumbnailUrl, Video } from "../api";
import { useVideoContext } from "../contexts/video";
import { extractFilename } from "../util";

type GridViewProps = {
  videos: Video[];
};

const LONG_PRESS_TIMEOUT = 500;
const MOVE_THRESHOLD = 10;

export function GridView({ videos }: GridViewProps) {
  const showVideo = useVideoContext();
  const [columns, setColumns] = useState(5);
  const [selected, setSelected] = useState(() => new Set<string>());

  const longPressTimer = useRef(0);
  const isSelecting = useRef(false);
  // used to distinguish a click from a drag
  const pointerDownTarget = useRef<EventTarget | null>(null);
  const pointerDownCoords = useRef({ x: 0, y: 0 });

  const stopSelecting = useCallback(() => {
    window.clearTimeout(longPressTimer.current);
    if (isSelecting.current) {
      document.documentElement.style.overflow = "";
      isSelecting.current = false;
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (longPressTimer.current === 0) {
      return;
    }
    const dx = e.clientX - pointerDownCoords.current.x;
    const dy = e.clientY - pointerDownCoords.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD) {
      window.clearTimeout(longPressTimer.current);
    }
  }, []);

  const handlePointerUp = useCallback(
    (video: Video, e: React.PointerEvent) => {
      const wasSelecting = isSelecting.current;
      stopSelecting();
      // if we just finished selecting, we don't want to trigger a click
      if (wasSelecting) {
        return;
      }
      // if the pointer down and up targets are the same, it's a click
      if (pointerDownTarget.current === e.currentTarget) {
        showVideo(video);
      }
    },
    [showVideo, stopSelecting]
  );

  return (
    <>
      <div className="navbar grid-view-navbar">
        {[2, 3, 4, 5, 6].map((columnOption) => (
          <button
            key={columnOption}
            onClick={() => setColumns(columnOption)}
            disabled={columns === columnOption}
          >
            {columnOption}
          </button>
        ))}
        <a href="/?edit">Tags</a>
      </div>
      <div
        className="grid-view"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        onPointerUp={stopSelecting}
        onPointerLeave={stopSelecting}
        onPointerMove={handlePointerMove}
      >
        {videos.map((video) => (
          <button
            key={video.thumbnail_name}
            className={`thumbnail ${
              selected.has(video.thumbnail_name) ? "selected" : ""
            }`}
            onPointerDown={(e) => {
              // we need to handle click events ourselves to distinguish from drags
              e.preventDefault();
              pointerDownTarget.current = e.currentTarget;
              pointerDownCoords.current = { x: e.clientX, y: e.clientY };
              // if the user holds their finger down, start selecting
              longPressTimer.current = window.setTimeout(() => {
                document.documentElement.style.overflow = "hidden";
                isSelecting.current = true;
                setSelected((s) => new Set(s).add(video.thumbnail_name));
              }, LONG_PRESS_TIMEOUT);
            }}
            onPointerUp={(e) => handlePointerUp(video, e)}
            onPointerEnter={() => {
              if (isSelecting.current) {
                setSelected((s) => new Set(s).add(video.thumbnail_name));
              }
            }}
          >
            <img
              src={getThumbnailUrl(video).toString()}
              alt={extractFilename(video)}
              loading="lazy"
            />
            <div className="tagdots">
              {video.tags.map((tag) => (
                <div data-tag={tag} key={tag} className="tagdot" />
              ))}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
