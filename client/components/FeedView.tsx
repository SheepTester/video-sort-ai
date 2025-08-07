import { useEffect, useRef, useState } from "react";
import { getVideoUrl, getThumbnailUrl, Video } from "../api";

type FeedViewProps = {
  videos: Video[];
};

function FeedItem({ video }: { video: Video }) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

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

  useEffect(() => {
    if (isIntersecting) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }
  }, [isIntersecting]);

  const thumbnailUrl = getThumbnailUrl(video);
  const videoUrl = getVideoUrl(video);

  return (
    <div
      ref={ref}
      className="feed-item"
      style={{ paddingBottom: `${100 / aspectRatio}%` }}
    >
      <img
        src={thumbnailUrl.toString()}
        alt={video.path}
        className="feed-thumbnail"
        onLoad={(e) => {
          const img = e.currentTarget;
          setAspectRatio(img.naturalWidth / img.naturalHeight);
        }}
      />
      <video
        ref={videoRef}
        className={`feed-video ${isIntersecting ? "visible" : ""}`}
        src={videoUrl.toString()}
        controls
        muted
        loop
      />
    </div>
  );
}

export function FeedView({ videos }: FeedViewProps) {
  return (
    <div className="feed-view">
      {videos.map((video) => (
        <FeedItem key={video.path} video={video} />
      ))}
    </div>
  );
}
