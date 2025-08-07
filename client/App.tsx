import { useEffect, useState } from "react";
import { getList, State } from "./api";

type AppInnerProps = {
  initState: State;
};
function AppInner({ initState }: AppInnerProps) {
  const [state, setState] = useState<State>(initState);

  return <pre>{JSON.stringify(state, null, 2)}</pre>;
}

export function App() {
  const [state, setState] = useState<State>();

  useEffect(() => {
    getList().then(setState);
  }, []);

  return state ? <AppInner initState={state} /> : null;
}
