import { useEffect, useState } from "react";
import { getList, State } from "./api";
import { GridView } from "./components/GridView";
import { ListView } from "./components/ListView";
import { FeedView } from "./components/FeedView";
import { Navbar } from "./components/Navbar";
import { SetStateContext } from "./state";

export type ViewMode =
  | { mode: "list" }
  | { mode: "feed" }
  | { mode: "grid"; columns: 2 | 3 | 4 | 5 };

type AppInnerProps = {
  state: State;
};

function AppInner({ state }: AppInnerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>({
    mode: "grid",
    columns: 3,
  });

  return (
    <div>
      <Navbar viewMode={viewMode} setViewMode={setViewMode} />
      {viewMode.mode === "grid" ? (
        <GridView columns={viewMode.columns} videos={state.videos} />
      ) : viewMode.mode === "list" ? (
        <ListView videos={state.videos} />
      ) : (
        <FeedView videos={state.videos} />
      )}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    getList().then(setState);
  }, []);

  if (!state) {
    return null;
  }

  return (
    <SetStateContext.Provider value={setState}>
      <AppInner state={state} />
    </SetStateContext.Provider>
  );
}
