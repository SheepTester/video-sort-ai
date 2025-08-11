import { Video } from "../api";
import { FeedItem } from "./FeedItem";

type FeedViewProps = {
  videos: Video[];
};

export function FeedView({ videos }: FeedViewProps) {
  return (
    <div className="feed-view">
      {videos.map((video) => (
        <FeedItem key={video.thumbnail_name} video={video} />
      ))}
    </div>
  );
}
