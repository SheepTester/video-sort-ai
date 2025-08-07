import { createContext, useContext } from "react";
import { State } from "./api";

type SetState = (newState: State) => void;

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const SetStateContext = createContext<SetState>(() => {});

export function useSetState() {
  return useContext(SetStateContext);
}
