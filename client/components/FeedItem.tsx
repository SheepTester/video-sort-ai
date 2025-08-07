import { useEffect, useRef, useState } from "react";
import { getVideoUrl, getThumbnailUrl, Video } from "../api";

type FeedItemProps = {
  video: Video;
};

export function FeedItem({ video }: FeedItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
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
      <img
        src={thumbnailUrl.toString()}
        alt={video.path}
        className="feed-thumbnail"
      />
      {isIntersecting && (
        <video
          className="feed-video"
          src={videoUrl.toString()}
          controls
          autoPlay
          loop
        />
      )}
    </div>
  );
}
