import { useEffect, useState } from "react";
import { getList, State } from "./api";
import { FeedView } from "./components/FeedView";
import { GridView } from "./components/GridView";
import { ListView } from "./components/ListView";
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

  const handleStateChange = (newState: State) => {
    setState(newState);
  };

  const renderView = () => {
    switch (viewMode.mode) {
      case "grid":
        return <GridView columns={viewMode.columns} videos={state.videos} />;
      case "feed":
        return <FeedView videos={state.videos} />;
      case "list":
        return (
          <ListView
            videos={state.videos}
            onStateChange={handleStateChange}
          />
        );
      default:
        return <pre>{JSON.stringify(state, null, 2)}</pre>;
    }
  };

  return (
    <div>
      <Navbar viewMode={viewMode} setViewMode={setViewMode} />
      {renderView()}
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
