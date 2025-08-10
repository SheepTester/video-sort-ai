export type ViewMode = { mode: "list" } | { mode: "feed" } | { mode: "grid" };

export type Filter =
  | { mode: "none" }
  | { mode: "tagless" }
  | { mode: "with-tag"; tag: string };

export type Sort = { by: "mtime" | "size"; desc: boolean };

export type Clip = {
  id: string;
  /** references `path` in `state.videos` */
  path: string;
  // in seconds
  start: number;
  end: number;
};

export type ProjectState = {
  clips: Clip[];
  uninitialized?: boolean;
};
