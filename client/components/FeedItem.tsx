import { useEffect, useRef, useState } from "react";
import { Video } from "../api";
import { TagEdit } from "./TagEdit";
import { Video as VideoComp } from "./Video";

type FeedItemProps = {
  video: Video;
};

export function FeedItem({ video }: FeedItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldMount, setShouldMount] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef) return;

    let timeoutId: number | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting) {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setShouldMount(true);
        } else {
          timeoutId = window.setTimeout(() => {
            setShouldMount(false);
          }, 5000);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(currentRef);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      observer.unobserve(currentRef);
    };
  }, []);

  useEffect(() => {
    if (isIntersecting) {
      videoRef.current?.play();
    } else {
      videoRef.current?.pause();
    }
  }, [isIntersecting]);

  return (
    <div ref={ref} className="feed-item">
      <div className="tagswraper">
        <TagEdit video={video} />
      </div>
      {shouldMount && <VideoComp video={video} videoRef={videoRef} />}
    </div>
  );
}
