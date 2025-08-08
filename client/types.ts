export type ViewMode =
  | { mode: "list" }
  | { mode: "feed" }
  | { mode: "grid"; columns: 2 | 3 | 4 | 5 };
export type Filter =
  | { mode: "none" }
  | { mode: "tagless" }
  | { mode: "with-tag"; tag: string };
