import { Video } from "../api";
import { ListItem } from "./ListItem";

type ListViewProps = {
  videos: Video[];
};

export function ListView({ videos }: ListViewProps) {
  return (
    <div className="list-view">
      {videos.map((video) => (
        <ListItem key={video.thumbnail_name} video={video} />
      ))}
    </div>
  );
}
