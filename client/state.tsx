import { createContext, ReactNode, useContext } from "react";
import { State } from "./api";

type SetState = (newState: State) => void;

const SetStateContext = createContext<SetState | undefined>(undefined);

export function StateProvider({
  children,
  setState,
}: {
  children: ReactNode;
  setState: SetState;
}) {
  return (
    <SetStateContext.Provider value={setState}>
      {children}
    </SetStateContext.Provider>
  );
}

export function useSetState() {
  const context = useContext(SetStateContext);
  if (context === undefined) {
    throw new Error("useSetState must be used within a StateProvider");
  }
  return context;
}
