export type ViewMode =
  | { mode: "list" }
  | { mode: "feed" }
  | { mode: "grid" };
export type Filter =
  | { mode: "none" }
  | { mode: "tagless" }
  | { mode: "with-tag"; tag: string };
