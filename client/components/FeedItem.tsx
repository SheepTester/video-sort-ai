import { useEffect, useRef, useState } from "react";
import { getVideoUrl, getThumbnailUrl, Video } from "../api";

type FeedItemProps = {
  video: Video;
};

export function FeedItem({ video }: FeedItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play();
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const thumbnailUrl = getThumbnailUrl(video);
  const videoUrl = getVideoUrl(video);

  return (
    <div ref={ref} className="feed-item">
      <video
        className="feed-video"
        src={videoUrl.toString()}
        controls
        loop
        poster={thumbnailUrl.toString()}
        preload="none"
        ref={videoRef}
      />
    </div>
  );
}
