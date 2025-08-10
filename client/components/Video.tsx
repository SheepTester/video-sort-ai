import { PointerEvent, RefObject, useRef, useState } from "react";
import { getThumbnailUrl, getVideoUrl, Video } from "../api";

export type VideoProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  video: Video;
};
export function Video({ videoRef, video }: VideoProps) {
  const pointerId = useRef<number | null>(null);
  const [speedUp, setSpeedUp] = useState(false);

  const handlePointerEnd = (e: PointerEvent) => {
    if (pointerId.current === e.pointerId) {
      if (videoRef.current) videoRef.current.playbackRate = 1;
      pointerId.current = null;
      setSpeedUp(false);
    }
  };

  return (
    <div className="feed-video-wrapper">
      <video
        className="feed-video"
        src={getVideoUrl(video).toString()}
        controls
        loop
        poster={getThumbnailUrl(video).toString()}
        preload="none"
        ref={videoRef}
      />
      <button
        className={`speed ${speedUp ? "sped-up" : ""}`}
        onPointerDown={(e) => {
          if (pointerId.current === null) {
            if (videoRef.current) videoRef.current.playbackRate = 2;
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
  );
}
