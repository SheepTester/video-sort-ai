import { useState } from "react";
import { getThumbnailUrl, Video } from "../api";
import { useVideoContext } from "../contexts/video";
import { extractFilename } from "../util";

type GridViewProps = {
  videos: Video[];
};

export function GridView({ videos }: GridViewProps) {
  const showVideo = useVideoContext();
  const [columns, setColumns] = useState(5);
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
      >
        {videos.map((video) => (
          <button
            key={video.thumbnail_name}
            className="thumbnail"
            onClick={() => showVideo(video)}
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
