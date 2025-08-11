import { useEffect, useState } from "react";
import { addTag, getThumbnailUrl, removeTag, Video } from "../api";
import { useVideoContext } from "../contexts/video";
import { extractFilename } from "../util";
import { useSetState } from "../contexts/state";

export type GridViewProps = {
  videos: Video[];
};
export function GridView({ videos }: GridViewProps) {
  const showVideo = useVideoContext();
  const [columns, setColumns] = useState(5);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set<string>());
  const setState = useSetState();
  return (
    <>
      {selectMode ? (
        <div className="navbar grid-view-navbar">
          <button
            onClick={() => {
              setSelectMode(false);
              setSelected(new Set());
            }}
          >
            Exit
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const { submitter } = e.nativeEvent as SubmitEvent;
              if (!(submitter instanceof HTMLInputElement)) {
                return;
              }
              const tag = String(new FormData(e.currentTarget).get("tag"));
              const videos = Array.from(selected, (thumbnail_name) => ({
                thumbnail_name,
              }));
              if (submitter.value === "+") {
                addTag(videos, tag).then(setState);
              } else if (submitter.value === "−") {
                removeTag(videos, tag).then(setState);
              } else {
                console.error("what is this", submitter.value);
              }
            }}
            style={{ gap: "10px" }}
          >
            <input name="tag" placeholder="add a tag" type="text" list="tags" />
            <input type="submit" name="submit" value="+" />
            <input type="submit" name="submit" value="−" />
          </form>
        </div>
      ) : (
        <div className="navbar grid-view-navbar">
          <button onClick={() => setSelectMode(true)}>Select</button>
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
      )}
      <div
        className="grid-view"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {videos.map((video) => {
          return (
            <button
              key={video.thumbnail_name}
              className={`thumbnail ${
                selected.has(video.thumbnail_name) ? "selected" : ""
              }`}
              onClick={() =>
                selectMode
                  ? setSelected((selected) =>
                      selected.has(video.thumbnail_name)
                        ? new Set(
                            [...selected].filter(
                              (th) => th !== video.thumbnail_name
                            )
                          )
                        : new Set([...selected, video.thumbnail_name])
                    )
                  : showVideo(video)
              }
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
          );
        })}
      </div>
    </>
  );
}
