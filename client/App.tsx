import { useEffect, useState } from "react";
import { getList, State } from "./api";
import { GridView } from "./components/GridView";
import { Navbar } from "./components/Navbar";

export type ViewMode =
  | { mode: "list" }
  | { mode: "feed" }
  | { mode: "grid"; columns: 2 | 3 | 4 | 5 };

type AppInnerProps = {
  initState: State;
};
function AppInner({ initState }: AppInnerProps) {
  const [state, setState] = useState<State>(initState);
  const [viewMode, setViewMode] = useState<ViewMode>({
    mode: "grid",
    columns: 3,
  });

  return (
    <div>
      <Navbar viewMode={viewMode} setViewMode={setViewMode} />
      {viewMode.mode === "grid" ? (
        <GridView columns={viewMode.columns} videos={state.videos} />
      ) : (
        <pre>{JSON.stringify(state, null, 2)}</pre>
      )}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<State>();

  useEffect(() => {
    getList().then(setState);
  }, []);

  return state ? <AppInner initState={state} /> : null;
}
