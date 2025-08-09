import { useEffect, useRef } from "react";
import { getVideoUrl, getThumbnailUrl, Video } from "../api";
import { useIntersection } from "../hooks/useIntersection";
import { TagEdit } from "./TagEdit";

type FeedItemProps = {
  video: Video;
};

export function FeedItem({ video }: FeedItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldMount, isIntersecting] = useIntersection(ref, {
    threshold: 0.5,
  });

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
    <div ref={ref} className="feed-item">
      <div className="tagswraper">
        <TagEdit video={video} />
      </div>
      {shouldMount && (
        <video
          className="feed-video"
          src={videoUrl.toString()}
          controls
          loop
          poster={thumbnailUrl.toString()}
          preload="none"
          ref={videoRef}
        />
      )}
    </div>
  );
}
