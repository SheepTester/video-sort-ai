import { createContext, useContext } from "react";
import { State } from "./api";

type SetState = (newState: State) => void;

export const SetStateContext = createContext<SetState>(() => {});

export function useSetState() {
  return useContext(SetStateContext);
}
