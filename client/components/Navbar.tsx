import { ViewMode } from "../App";

type NavbarProps = {
  viewMode: ViewMode;
  setViewMode: (viewMode: ViewMode) => void;
};

export function Navbar({ viewMode, setViewMode }: NavbarProps) {
  return (
    <div className="navbar">
      <button
        onClick={() => setViewMode({ mode: "list" })}
        disabled={viewMode.mode === "list"}
      >
        L
      </button>
      <button
        onClick={() => setViewMode({ mode: "feed" })}
        disabled={viewMode.mode === "feed"}
      >
        F
      </button>
      {(
        [2, 3, 4, 5] as const
      ).map((columns) => (
        <button
          key={columns}
          onClick={() => setViewMode({ mode: "grid", columns })}
          disabled={viewMode.mode === "grid" && viewMode.columns === columns}
        >
          {columns}
        </button>
      ))}
    </div>
  );
}
