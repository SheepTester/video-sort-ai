import { getThumbnailUrl, Video } from "../api";
import { useVideoContext } from "../contexts/video";

type GridViewProps = {
  columns: 2 | 3 | 4 | 5;
  videos: Video[];
};

export function GridView({ columns, videos }: GridViewProps) {
  const showVideo = useVideoContext();
  return (
    <div
      className="grid-view"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {videos.map((video) => (
        <button
          key={video.path}
          className="thumbnail"
          onClick={() => showVideo(video)}
        >
          <img
            src={getThumbnailUrl(video).toString()}
            alt={video.path}
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
  );
}
