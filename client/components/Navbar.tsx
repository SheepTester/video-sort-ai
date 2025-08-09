import { renameTag } from "../api";
import { useSetState } from "../contexts/state";
import { Filter, Sort, ViewMode } from "../types";

type NavbarProps = {
  viewMode: ViewMode;
  onViewMode: (viewMode: ViewMode) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
  tags: string[];
};

export function Navbar({
  viewMode,
  onViewMode,
  filter,
  onFilter,
  sort,
  onSort,
  tags,
}: NavbarProps) {
  const setState = useSetState();
  return (
    <div className="navbar">
      <button
        onClick={() => onViewMode({ mode: "list" })}
        disabled={viewMode.mode === "list"}
      >
        List
      </button>
      <button
        onClick={() => onViewMode({ mode: "feed" })}
        disabled={viewMode.mode === "feed"}
      >
        Feed
      </button>
      <button
        onClick={() => onViewMode({ mode: "grid" })}
        disabled={viewMode.mode === "grid"}
      >
        Grid
      </button>
      <select
        value={`${sort.by}-${sort.desc ? "desc" : "asc"}`}
        onChange={(e) => {
          const [type, desc] = e.currentTarget.value.split("-");
          onSort({
            by: type === "mtime" ? "mtime" : "size",
            desc: desc === "desc",
          });
        }}
      >
        <option value="mtime-desc">Newest first</option>
        <option value="mtime-asc">Oldest first</option>
        <option value="size-desc">Largest first</option>
        <option value="size-asc">Smallest first</option>
      </select>
      <button
        onClick={() => {
          const oldTag = prompt("Tag to rename:");
          if (!oldTag) return;
          const newTag = prompt(`New name for ${oldTag}:`);
          if (!newTag) return;
          renameTag(oldTag, newTag).then(setState);
        }}
      >
        Rename tag
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
