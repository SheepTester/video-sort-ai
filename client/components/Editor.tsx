import { useEffect, useMemo, useState } from "react";
import { State } from "../api";

export type ProjectState = {
  clips: {
    /** references `path` in `state.videos` */
    path: string;
    // in seconds
    start: number;
    end: number;
  }[];
  uninitialized?: boolean;
};

export type EditorProps = {
  state: State;
  tag: string;
};
export function Editor({ state, tag }: EditorProps) {
  const [projectState, setProjectState] = useState<ProjectState>({
    clips: [],
    uninitialized: true,
  });

  useEffect(() => {
    const project = localStorage.getItem(`video-sort/project/${tag}`);
    setProjectState(project ? JSON.parse(project) : { clips: [] });
  }, []);

  useEffect(() => {
    if (!projectState.uninitialized) {
      localStorage.setItem(
        `video-sort/project/${tag}`,
        JSON.stringify(projectState)
      );
    }
  }, [projectState]);

  const videos = useMemo(
    () => state.videos.filter((video) => video.tags.includes(tag)),
    [state, tag]
  );

  // TEMP
  return <pre>{JSON.stringify(videos, null, 2)}</pre>;
}
