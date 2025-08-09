import { useId } from "react";
import { Filter, ViewMode } from "../types";

type NavbarProps = {
  viewMode: ViewMode;
  onViewMode: (viewMode: ViewMode) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  tags: string[];
};

export function Navbar({
  viewMode,
  onViewMode,
  filter,
  onFilter,
  tags,
}: NavbarProps) {
  return (
    <div className="navbar">
      <button
        onClick={() => onViewMode({ mode: "list" })}
        disabled={viewMode.mode === "list"}
      >
        Li
      </button>
      <button
        onClick={() => onViewMode({ mode: "feed" })}
        disabled={viewMode.mode === "feed"}
      >
        FY
      </button>
      <button
        onClick={() => onViewMode({ mode: "grid" })}
        disabled={viewMode.mode === "grid"}
      >
        Grid
      </button>
      <select
        value={
          filter.mode === "with-tag" ? `with-tag:${filter.tag}` : filter.mode
        }
        onChange={(e) =>
          onFilter(
            e.currentTarget.value === "none" ||
              e.currentTarget.value === "tagless"
              ? { mode: e.currentTarget.value }
              : {
                  mode: "with-tag",
                  tag: e.currentTarget.value.replace("with-tag:", ""),
                }
          )
        }
      >
        <option value="none">Default</option>
        <option value="tagless">No tags</option>
        <hr />
        {tags.map((tag) => (
          <option value={`with-tag:${tag}`} key={tag}>
            {tag}
          </option>
        ))}
        {filter.mode === "with-tag" && !tags.includes(filter.tag) ? (
          <option value={`with-tag:${filter.tag}`}>{filter.tag}</option>
        ) : null}
      </select>
    </div>
  );
}
