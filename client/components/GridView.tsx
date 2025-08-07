import { getThumbnailUrl, Video } from "../api";

type GridViewProps = {
  columns: 2 | 3 | 4 | 5;
  videos: Video[];
};

export function GridView({ columns, videos }: GridViewProps) {
  return (
    <div className="grid-view" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {videos.map((video) => (
        <div key={video.path} className="thumbnail">
          <img src={getThumbnailUrl(video).toString()} alt={video.path} />
        </div>
      ))}
    </div>
  );
}
